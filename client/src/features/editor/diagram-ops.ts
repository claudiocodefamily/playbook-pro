import {
  FIELD_HALF_WIDTH_YARDS,
  goalPostsY,
  newId,
  type Assignment,
  type DiagramPlayer,
  type FormationSlot,
  type PlayDiagram,
  type Point,
  type Position,
} from '@playbook/shared';
import { ballEntries, type BallEntry } from '../field/ball';
import { isCoverage, type ZoneAssignment } from '../field/coverage';
import {
  chainEnd,
  isPathAssignment,
  pathLength,
  playerPaths,
  type PathAssignment,
} from '../field/paths';

/** Máximo de jugadores por lado en la cancha. */
export const MAX_PER_SIDE = 11;

/** Límites del diagram (los mismos que valida PointSchema) para no sacar a nadie del campo. */
const BOUNDS = { minX: -FIELD_HALF_WIDTH_YARDS, maxX: FIELD_HALF_WIDTH_YARDS, minY: -20, maxY: 75 };

/** Al soltar un jugador se ajusta a la media yarda: posiciones limpias y fáciles de repetir. */
const SNAP_YARDS = 0.5;

export function snapAndClamp(point: Point): Point {
  const snap = (value: number) => Math.round(value / SNAP_YARDS) * SNAP_YARDS;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    x: clamp(snap(point.x), BOUNDS.minX, BOUNDS.maxX),
    y: clamp(snap(point.y), BOUNDS.minY, BOUNDS.maxY),
  };
}

function clampPoint(point: Point): Point {
  return {
    x: Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, point.x)),
    y: Math.min(BOUNDS.maxY, Math.max(BOUNDS.minY, point.y)),
  };
}

/** Desplaza los trazos de un jugador para que lo acompañen cuando se mueve. */
function shiftAssignments(
  assignments: readonly Assignment[],
  playerId: string,
  dx: number,
  dy: number,
): Assignment[] {
  if (dx === 0 && dy === 0) return [...assignments];
  return assignments.map((assignment) =>
    assignment.playerId === playerId && isPathAssignment(assignment)
      ? {
          ...assignment,
          points: assignment.points.map((point) =>
            clampPoint({ x: point.x + dx, y: point.y + dy }),
          ),
        }
      : assignment,
  );
}

/** Mueve al jugador; sus rutas y bloqueos se mueven con él y conservan la forma. */
export function movePlayer(diagram: PlayDiagram, playerId: string, to: Point): PlayDiagram {
  const point = snapAndClamp(to);
  const player = diagram.players.find((candidate) => candidate.id === playerId);
  if (!player) return diagram;
  return {
    ...diagram,
    players: diagram.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, ...point } : candidate,
    ),
    assignments: shiftAssignments(
      diagram.assignments,
      playerId,
      point.x - player.x,
      point.y - player.y,
    ),
  };
}

export type PlayerChanges = Partial<
  Pick<DiagramPlayer, 'label' | 'position' | 'number' | 'rosterPlayerId'>
>;

/** Cambia datos del jugador. `number` o `rosterPlayerId` a undefined los quitan. */
export function updatePlayer(
  diagram: PlayDiagram,
  playerId: string,
  changes: PlayerChanges,
): PlayDiagram {
  return {
    ...diagram,
    players: diagram.players.map((player) => {
      if (player.id !== playerId) return player;
      const { number: previousNumber, rosterPlayerId: previousRoster, ...rest } = player;
      const { number: changedNumber, rosterPlayerId: changedRoster, ...otherChanges } = changes;
      const number = 'number' in changes ? changedNumber : previousNumber;
      const rosterPlayerId = 'rosterPlayerId' in changes ? changedRoster : previousRoster;
      return {
        ...rest,
        ...otherChanges,
        ...(number === undefined ? {} : { number }),
        ...(rosterPlayerId === undefined ? {} : { rosterPlayerId }),
      };
    }),
  };
}

/** Quita al jugador y todo lo que depende de él: sus asignaciones y su paso por el balón. */
export function removePlayer(diagram: PlayDiagram, playerId: string): PlayDiagram {
  return {
    ...diagram,
    players: diagram.players.filter((player) => player.id !== playerId),
    assignments: diagram.assignments.filter(
      (assignment) =>
        assignment.playerId !== playerId &&
        !('targetPlayerId' in assignment && assignment.targetPlayerId === playerId),
    ),
    ball: {
      carrierTimeline: diagram.ball.carrierTimeline.filter((entry) => entry.playerId !== playerId),
    },
  };
}

export function countSide(diagram: PlayDiagram, side: DiagramPlayer['side']): number {
  return diagram.players.filter((player) => player.side === side).length;
}

/** Añade un jugador. Devuelve null si ese lado ya tiene 11. */
export function addPlayer(
  diagram: PlayDiagram,
  input: { side: DiagramPlayer['side']; position: Position; label: string; at: Point },
): { diagram: PlayDiagram; playerId: string } | null {
  if (countSide(diagram, input.side) >= MAX_PER_SIDE) return null;
  const player: DiagramPlayer = {
    id: newId(),
    side: input.side,
    position: input.position,
    label: input.label,
    ...snapAndClamp(input.at),
  };
  return { diagram: { ...diagram, players: [...diagram.players, player] }, playerId: player.id };
}

/**
 * Coloca a un lado de la cancha según una formación. Los jugadores que ya estaban se
 * reutilizan (primero por etiqueta, después por posición) para que conserven sus rutas
 * y asignaciones; los huecos que sobran crean jugadores nuevos y los jugadores que ya
 * no caben en la formación se quitan.
 */
export function applyFormation(
  diagram: PlayDiagram,
  slots: readonly FormationSlot[],
  side: DiagramPlayer['side'],
): PlayDiagram {
  const available = diagram.players.filter((player) => player.side === side);
  const take = (match: (player: DiagramPlayer) => boolean): DiagramPlayer | undefined => {
    const index = available.findIndex(match);
    return index === -1 ? undefined : available.splice(index, 1)[0];
  };

  // Primera pasada por etiqueta exacta ("X" sigue siendo el X); segunda por posición.
  const byLabel = slots.map((slot) => take((player) => player.label === slot.label));
  const placed = slots.map((slot, index) => {
    const existing = byLabel[index] ?? take((player) => player.position === slot.position);
    return {
      id: existing?.id ?? newId(),
      side,
      position: slot.position,
      label: slot.label,
      x: slot.x,
      y: slot.y,
      ...(existing?.number === undefined ? {} : { number: existing.number }),
      ...(existing?.rosterPlayerId === undefined
        ? {}
        : { rosterPlayerId: existing.rosterPlayerId }),
    } satisfies DiagramPlayer;
  });

  // Las rutas de los jugadores reutilizados viajan con ellos a su nuevo sitio.
  let assignments = diagram.assignments;
  for (const player of placed) {
    const before = diagram.players.find((candidate) => candidate.id === player.id);
    if (before) {
      assignments = shiftAssignments(
        assignments,
        player.id,
        player.x - before.x,
        player.y - before.y,
      );
    }
  }

  let result: PlayDiagram = {
    ...diagram,
    players: [...diagram.players.filter((player) => player.side !== side), ...placed],
    assignments,
  };
  for (const leftover of available) {
    result = removePlayer(result, leftover.id);
  }
  return result;
}

/** Lo que se puede dibujar desde un jugador. */
export const DRAW_TYPES = ['route', 'block', 'motion', 'blitz'] as const;
export type DrawType = (typeof DRAW_TYPES)[number];

/** Velocidad aproximada (yardas por segundo) para calcular cuánto dura cada trazo. */
const SPEED: Readonly<Record<DrawType, number>> = { route: 6.5, blitz: 6.5, block: 2.5, motion: 4 };
const MAX_POINTS: Readonly<Record<DrawType, number>> = {
  route: 20,
  blitz: 20,
  motion: 20,
  block: 10,
};
const DEFAULT_STYLE: Readonly<Record<DrawType, PathAssignment['style']>> = {
  route: { line: 'solid', end: 'arrow', curved: false },
  block: { line: 'solid', end: 'block', curved: false },
  motion: { line: 'dashed', end: 'arrow', curved: false },
  blitz: { line: 'solid', end: 'arrow', curved: false, color: '#ef4444' },
};
/** Un trazo más corto que esto se toma como un toque, no como un dibujo. */
export const MIN_PATH_YARDS = 1;
const TIME_LIMIT = 30;

/**
 * Reduce un trazo a mano alzada a sus puntos clave (algoritmo de Ramer-Douglas-Peucker):
 * quita los puntos que se desvían menos de `tolerance` yardas de la línea recta.
 */
export function simplifyPath(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return [...points];
  let farthest = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    if (!point) continue;
    const distance = distanceToSegment(point, first, last);
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  if (farthest <= tolerance) return [first, last];
  const left = simplifyPath(points.slice(0, index + 1), tolerance);
  const right = simplifyPath(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Convierte lo dibujado en puntos limpios: simplificados, en la media yarda y sin repetidos. */
export function cleanPath(origin: Point, drawn: readonly Point[], maxPoints: number): Point[] {
  let tolerance = 0.6;
  let simplified = simplifyPath([origin, ...drawn], tolerance);
  while (simplified.length - 1 > maxPoints) {
    tolerance *= 1.5;
    simplified = simplifyPath([origin, ...drawn], tolerance);
  }
  const result: Point[] = [];
  let previous = snapAndClamp(origin);
  for (const point of simplified.slice(1).map(snapAndClamp)) {
    if (point.x === previous.x && point.y === previous.y) continue;
    result.push(point);
    previous = point;
  }
  return result;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Añade un trazo dibujado desde un jugador. Las rutas, blitz y bloqueos siguen al último
 * trazo del jugador (por ejemplo, una ruta tras el motion); el motion es antes del snap y
 * sustituye al que hubiera. Devuelve null si el trazo es demasiado corto.
 */
export function addPathAssignment(
  diagram: PlayDiagram,
  input: { playerId: string; type: DrawType; points: readonly Point[] },
): { diagram: PlayDiagram; assignmentId: string } | null {
  const player = diagram.players.find((candidate) => candidate.id === input.playerId);
  if (!player) return null;
  const paths = playerPaths(diagram, player.id);
  const motion = input.type === 'motion';
  const withoutMotion = motion
    ? diagram.assignments.filter(
        (assignment) => !(assignment.playerId === player.id && assignment.type === 'motion'),
      )
    : diagram.assignments;
  const origin = motion ? { x: player.x, y: player.y } : chainEnd(diagram, player.id);
  if (!origin) return null;
  const points = cleanPath(origin, input.points, MAX_POINTS[input.type]);
  const length = pathLength([origin, ...points]);
  if (points.length === 0 || length < MIN_PATH_YARDS) return null;

  const duration = Math.max(0.5, length / SPEED[input.type]);
  const startTime = motion
    ? -Math.min(10, round(duration))
    : Math.min(TIME_LIMIT, Math.max(0, ...paths.map((path) => path.endTime)));
  const endTime = motion ? 0 : Math.min(TIME_LIMIT, round(startTime + duration));
  const id = newId();
  const base = {
    id,
    playerId: player.id,
    style: { ...DEFAULT_STYLE[input.type] },
    startTime,
    endTime,
    points,
  };
  const assignment: Assignment =
    input.type === 'block' ? { ...base, type: 'block' } : { ...base, type: input.type };
  return { diagram: { ...diagram, assignments: [...withoutMotion, assignment] }, assignmentId: id };
}

export type AssignmentChanges = Partial<Pick<PathAssignment, 'style'>> & {
  /** Solo para rutas. Cadena vacía quita el nombre. */
  routeName?: string;
};

export function updateAssignment(
  diagram: PlayDiagram,
  assignmentId: string,
  changes: AssignmentChanges,
): PlayDiagram {
  return {
    ...diagram,
    assignments: diagram.assignments.map((assignment) => {
      if (assignment.id !== assignmentId) return assignment;
      const style = changes.style ? { ...assignment.style, ...changes.style } : assignment.style;
      if (assignment.type !== 'route' || changes.routeName === undefined) {
        return { ...assignment, style };
      }
      const { routeName: _previous, ...rest } = assignment;
      const routeName = changes.routeName.slice(0, 30);
      return { ...rest, style, ...(routeName.trim() ? { routeName } : {}) };
    }),
  };
}

export function removeAssignment(diagram: PlayDiagram, assignmentId: string): PlayDiagram {
  return {
    ...diagram,
    assignments: diagram.assignments.filter((assignment) => assignment.id !== assignmentId),
  };
}

/** Cómo recibe un jugador el balón después del snap (la patada, del equipo contrario). */
export const BALL_TRANSFERS = ['handoff', 'pitch', 'pass', 'kick'] as const;
export type BallTransfer = (typeof BALL_TRANSFERS)[number];
const MAX_BALL_ENTRIES = 10;
/** Separación mínima entre dos cambios de manos, en segundos. */
const BALL_GAP = 0.4;

function withBall(diagram: PlayDiagram, entries: BallEntry[]): PlayDiagram {
  return { ...diagram, ball: { ...diagram.ball, carrierTimeline: entries } };
}

/**
 * Quién recibe el snap. Si el siguiente cambio de manos era para ese mismo jugador, deja
 * de tener sentido y se quita junto con todo lo que venía después.
 */
export function setSnapReceiver(diagram: PlayDiagram, playerId: string): PlayDiagram {
  const rest = ballEntries(diagram).filter((entry) => entry.action !== 'snap');
  const cut = rest.findIndex((entry) => entry.playerId === playerId);
  const kept = cut === 0 ? [] : rest;
  return withBall(diagram, [{ t: 0, playerId, action: 'snap' }, ...kept]);
}

/**
 * Le da el balón a un jugador con un handoff, un pitch o un pase. El momento se propone
 * solo: el pase sale poco antes de que el receptor acabe su ruta. Devuelve null si aún no
 * hay snap, si el jugador ya tiene el balón o si se llegó al máximo de cambios de manos.
 */
export function addBallTransfer(
  diagram: PlayDiagram,
  playerId: string,
  action: BallTransfer,
): PlayDiagram | null {
  const entries = ballEntries(diagram);
  const last = entries.at(-1);
  // Sin portador (tras un field goal) el balón ya no cambia de manos.
  if (!last?.playerId || last.playerId === playerId || entries.length >= MAX_BALL_ENTRIES) {
    return null;
  }
  const routeEnd = Math.max(0, ...playerPaths(diagram, playerId).map((path) => path.endTime));
  const suggested =
    action === 'pass'
      ? routeEnd > 0
        ? routeEnd - 0.6
        : last.t + 1.5
      : last.t + TRANSFER_DELAY[action];
  const t = round(Math.min(TIME_LIMIT - 2, Math.max(suggested, last.t + BALL_GAP)));
  return withBall(diagram, [...entries, { t, playerId, action }]);
}

/** Segundos desde el cambio de manos anterior hasta este, si nadie dice otra cosa. */
const TRANSFER_DELAY: Readonly<Record<Exclude<BallTransfer, 'pass'>, number>> = {
  handoff: 0.6,
  pitch: 0.8,
  // El punter recibe el snap a 14 yardas y patea en unos 2 segundos.
  kick: 2,
};

/**
 * Kickoff: el balón sale del tee (en la LOS) hacia el returner. Sale cuando el kicker
 * acaba su carrera, si la tiene dibujada. Devuelve null si el balón ya tiene historia.
 */
export function addKickoff(diagram: PlayDiagram, playerId: string): PlayDiagram | null {
  if (diagram.ball.carrierTimeline.length > 0) return null;
  const kickers = diagram.players.filter((player) => player.position === 'K');
  const runUp = Math.max(
    0,
    ...kickers.flatMap((kicker) => playerPaths(diagram, kicker.id).map((path) => path.endTime)),
  );
  const t = round(Math.min(TIME_LIMIT - 2, Math.max(BALL_GAP, runUp || 1)));
  return withBall(diagram, [{ t, playerId, action: 'kick' }]);
}

/** Dónde apunta un field goal: entre los postes. Null si quedan a más de 75 yardas. */
export function fieldGoalTarget(diagram: PlayDiagram): Point | null {
  const y = goalPostsY(diagram.field.yardLine);
  return y <= BOUNDS.maxY ? { x: 0, y } : null;
}

/**
 * Field goal o PAT: el que tiene el balón (el holder) lo sujeta y el kicker lo patea
 * entre los postes. Nadie lo recibe. Devuelve null si no hay portador o no llega.
 */
export function addFieldGoal(diagram: PlayDiagram): PlayDiagram | null {
  const entries = ballEntries(diagram);
  const last = entries.at(-1);
  const target = fieldGoalTarget(diagram);
  if (!last?.playerId || !target || entries.length >= MAX_BALL_ENTRIES) return null;
  // El snap llega al holder en algo más de medio segundo; la patada sale enseguida.
  const t = round(Math.min(TIME_LIMIT - 2, last.t + (last.action === 'snap' ? 1.3 : 0.8)));
  return withBall(diagram, [...entries, { t, action: 'kick', target }]);
}

/**
 * Mueve el balón a otra yarda (1 = propia 1, 99 = yarda 1 rival). Los field goals siguen
 * apuntando a los postes; si ya no llegan, se quitan (con lo que venía después).
 */
export function setYardLine(diagram: PlayDiagram, yardLine: number): PlayDiagram {
  const next = Math.round(Math.min(99, Math.max(1, yardLine)));
  if (next === diagram.field.yardLine) return diagram;
  const before = goalPostsY(diagram.field.yardLine);
  const moved: PlayDiagram = { ...diagram, field: { ...diagram.field, yardLine: next } };
  const target = fieldGoalTarget(moved);
  const entries = ballEntries(diagram);
  const isFieldGoal = (entry: BallEntry) =>
    entry.action === 'kick' && entry.target?.x === 0 && entry.target.y === before;
  const firstLost = target ? -1 : entries.findIndex(isFieldGoal);
  const kept = firstLost === -1 ? entries : entries.slice(0, firstLost);
  return withBall(
    moved,
    kept.map((entry) => (target && isFieldGoal(entry) ? { ...entry, target } : entry)),
  );
}

/** Cambia cuándo sale el balón, sin adelantar al cambio anterior ni pasar al siguiente. */
export function setBallTime(diagram: PlayDiagram, index: number, t: number): PlayDiagram {
  const entries = ballEntries(diagram);
  const entry = entries[index];
  if (!entry || entry.action === 'snap') return diagram;
  const min = (entries[index - 1]?.t ?? 0) + BALL_GAP;
  const max = (entries[index + 1]?.t ?? TIME_LIMIT + BALL_GAP) - BALL_GAP;
  const clamped = round(Math.min(max, Math.max(min, t)));
  if (clamped === entry.t) return diagram;
  return withBall(
    diagram,
    entries.map((candidate, i) => (i === index ? { ...candidate, t: clamped } : candidate)),
  );
}

/** Quita un cambio de manos y los que venían después (sin él, ya no tienen sentido). */
export function removeBallEntry(diagram: PlayDiagram, index: number): PlayDiagram {
  return withBall(diagram, ballEntries(diagram).slice(0, index));
}

/** Duración mínima de un trazo en la línea de tiempo, en segundos. */
export const MIN_PATH_SECONDS = 0.3;

/**
 * Cambia cuándo empieza y acaba un trazo. El motion siempre termina en el snap; el resto
 * empieza en el snap o después y no se solapa con los otros trazos del mismo jugador.
 */
export function setAssignmentTiming(
  diagram: PlayDiagram,
  assignmentId: string,
  timing: { startTime: number; endTime: number },
): PlayDiagram {
  const assignment = diagram.assignments.find((candidate) => candidate.id === assignmentId);
  if (!assignment || !isPathAssignment(assignment)) return diagram;
  let startTime: number;
  let endTime: number;
  if (assignment.type === 'motion') {
    endTime = 0;
    startTime = Math.min(-MIN_PATH_SECONDS, Math.max(-10, timing.startTime));
  } else {
    const others = playerPaths(diagram, assignment.playerId).filter(
      (path) => path.id !== assignment.id && path.type !== 'motion',
    );
    const before = others.filter((path) => path.startTime <= assignment.startTime);
    const after = others.filter((path) => path.startTime > assignment.startTime);
    const min = Math.max(0, ...before.map((path) => path.endTime));
    const max = Math.min(TIME_LIMIT, ...after.map((path) => path.startTime));
    const duration = Math.max(MIN_PATH_SECONDS, timing.endTime - timing.startTime);
    startTime = Math.min(Math.max(min, timing.startTime), max - MIN_PATH_SECONDS);
    endTime = Math.min(max, startTime + duration);
  }
  startTime = round(startTime);
  endTime = round(endTime);
  if (startTime === assignment.startTime && endTime === assignment.endTime) return diagram;
  return {
    ...diagram,
    assignments: diagram.assignments.map((candidate) =>
      candidate.id === assignmentId ? { ...candidate, startTime, endTime } : candidate,
    ),
  };
}

/** Coberturas que se dibujan desde un defensor. */
export const COVERAGE_TYPES = ['man', 'zone'] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

const COVERAGE_STYLE = { line: 'dashed', end: 'none', curved: false } as const;

/** Un defensor solo tiene una cobertura: la nueva sustituye a la anterior. */
function withCoverage(diagram: PlayDiagram, coverage: Assignment): PlayDiagram {
  return {
    ...diagram,
    assignments: [
      ...diagram.assignments.filter(
        (assignment) => !(assignment.playerId === coverage.playerId && isCoverage(assignment)),
      ),
      coverage,
    ],
  };
}

/** Marcaje al hombre (man): el defensor sigue a ese jugador de ataque toda la jugada. */
export function addManCoverage(
  diagram: PlayDiagram,
  defenderId: string,
  targetId: string,
): { diagram: PlayDiagram; assignmentId: string } | null {
  const defender = diagram.players.find((player) => player.id === defenderId);
  const target = diagram.players.find((player) => player.id === targetId);
  if (!defender || !target || defender.side !== 'D' || target.side !== 'O') return null;
  const id = newId();
  return {
    diagram: withCoverage(diagram, {
      id,
      playerId: defenderId,
      type: 'man',
      targetPlayerId: targetId,
      points: [],
      style: { ...COVERAGE_STYLE },
      startTime: 0,
      endTime: TIME_LIMIT,
    }),
    assignmentId: id,
  };
}

/** Zonas profundas (a partir de 12 yardas) y cortas, con el tamaño típico de cada una. */
const DEEP_ZONE_YARDS = 12;

/** Cobertura en zona: el defensor cae a la zona centrada en `center`. */
export function addZoneCoverage(
  diagram: PlayDiagram,
  defenderId: string,
  center: Point,
): { diagram: PlayDiagram; assignmentId: string } | null {
  const defender = diagram.players.find((player) => player.id === defenderId);
  if (!defender || defender.side !== 'D') return null;
  const point = snapAndClamp(center);
  const deep = point.y >= DEEP_ZONE_YARDS;
  const id = newId();
  return {
    diagram: withCoverage(diagram, {
      id,
      playerId: defenderId,
      type: 'zone',
      points: [point],
      zone: { shape: 'ellipse', width: deep ? 16 : 10, depth: deep ? 12 : 7 },
      style: { ...COVERAGE_STYLE },
      startTime: 0,
      endTime: TIME_LIMIT,
    }),
    assignmentId: id,
  };
}

export type ZoneChanges = Partial<Pick<ZoneAssignment['zone'], 'width' | 'depth' | 'name'>>;

/** Cambia el tamaño o el nombre de una zona. Nombre vacío lo quita. */
export function updateZone(
  diagram: PlayDiagram,
  assignmentId: string,
  changes: ZoneChanges,
): PlayDiagram {
  return {
    ...diagram,
    assignments: diagram.assignments.map((assignment) => {
      if (assignment.id !== assignmentId || assignment.type !== 'zone') return assignment;
      const { name: previousName, ...size } = assignment.zone;
      const name = changes.name === undefined ? previousName : changes.name.slice(0, 30);
      const width = Math.min(53, Math.max(2, changes.width ?? size.width));
      const depth = Math.min(40, Math.max(2, changes.depth ?? size.depth));
      return {
        ...assignment,
        zone: { ...size, width, depth, ...(name?.trim() ? { name } : {}) },
      };
    }),
  };
}

/** Mueve el centro de una zona (arrastrándola en la cancha). */
export function moveZone(diagram: PlayDiagram, assignmentId: string, center: Point): PlayDiagram {
  const point = snapAndClamp(center);
  return {
    ...diagram,
    assignments: diagram.assignments.map((assignment) =>
      assignment.id === assignmentId && assignment.type === 'zone'
        ? { ...assignment, points: [point] }
        : assignment,
    ),
  };
}
