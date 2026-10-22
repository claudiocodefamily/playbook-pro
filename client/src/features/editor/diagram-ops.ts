import {
  FIELD_HALF_WIDTH_YARDS,
  newId,
  type Assignment,
  type DiagramPlayer,
  type FormationSlot,
  type PlayDiagram,
  type Point,
  type Position,
} from '@playbook/shared';
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
const BOUNDS = { minX: -FIELD_HALF_WIDTH_YARDS, maxX: FIELD_HALF_WIDTH_YARDS, minY: -20, maxY: 60 };

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

export type PlayerChanges = Partial<Pick<DiagramPlayer, 'label' | 'position' | 'number'>>;

/** Cambia datos del jugador. `number: undefined` le quita el dorsal. */
export function updatePlayer(
  diagram: PlayDiagram,
  playerId: string,
  changes: PlayerChanges,
): PlayDiagram {
  return {
    ...diagram,
    players: diagram.players.map((player) => {
      if (player.id !== playerId) return player;
      const { number: previous, ...rest } = player;
      const { number: changed, ...otherChanges } = changes;
      const number = 'number' in changes ? changed : previous;
      return { ...rest, ...otherChanges, ...(number === undefined ? {} : { number }) };
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
