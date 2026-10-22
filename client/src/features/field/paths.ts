import type { Assignment, Point } from '@playbook/shared';

/** Lo mínimo de un diagram que hace falta para seguir los trazos (sirve también para miniaturas). */
export interface PathSource {
  players: readonly (Point & { id: string })[];
  assignments: readonly Assignment[];
}

/** Asignaciones que son un trazo sobre la cancha: rutas, motions, blitz y bloqueos. */
export type PathAssignment = Extract<Assignment, { type: 'route' | 'motion' | 'blitz' | 'block' }>;

export function isPathAssignment(assignment: Assignment): assignment is PathAssignment {
  return assignment.type !== 'man' && assignment.type !== 'zone';
}

/** Trazos de un jugador en orden de tiempo: primero el motion (antes del snap), luego el resto. */
export function playerPaths(diagram: PathSource, playerId: string): PathAssignment[] {
  return diagram.assignments
    .filter(isPathAssignment)
    .filter((assignment) => assignment.playerId === playerId)
    .sort((a, b) => a.startTime - b.startTime);
}

/**
 * Dónde empieza cada trazo. El primero sale del jugador; los siguientes, de donde terminó
 * el anterior. Así una ruta dibujada después de un motion arranca donde acaba el motion.
 */
export function pathOrigins(diagram: PathSource): Map<string, Point> {
  const origins = new Map<string, Point>();
  for (const player of diagram.players) {
    let cursor: Point = { x: player.x, y: player.y };
    for (const path of playerPaths(diagram, player.id)) {
      origins.set(path.id, cursor);
      cursor = path.points.at(-1) ?? cursor;
    }
  }
  return origins;
}

/** Dónde termina el último trazo del jugador (o el propio jugador si no tiene ninguno). */
export function chainEnd(diagram: PathSource, playerId: string): Point | undefined {
  const player = diagram.players.find((candidate) => candidate.id === playerId);
  if (!player) return undefined;
  return playerPaths(diagram, playerId).at(-1)?.points.at(-1) ?? { x: player.x, y: player.y };
}

export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** El punto que está a una fracción (0..1) del recorrido, medido por distancia. */
export function pointAlong(points: readonly Point[], fraction: number): Point {
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  const target = pathLength(points) * Math.min(1, Math.max(0, fraction));
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + segment >= target && segment > 0) {
      const t = (target - walked) / segment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    walked += segment;
  }
  return points.at(-1) ?? first;
}

/** Posición de cada jugador en el segundo `t` de la jugada (snap en t = 0). */
export function positionsAt(diagram: PathSource, t: number): Map<string, Point> {
  const positions = new Map<string, Point>();
  for (const player of diagram.players) {
    let cursor: Point = { x: player.x, y: player.y };
    for (const path of playerPaths(diagram, player.id)) {
      if (t <= path.startTime) break;
      const route = [cursor, ...path.points];
      if (t >= path.endTime || path.endTime === path.startTime) {
        cursor = path.points.at(-1) ?? cursor;
        continue;
      }
      cursor = pointAlong(route, (t - path.startTime) / (path.endTime - path.startTime));
      break;
    }
    positions.set(player.id, cursor);
  }
  return positions;
}

/** Desde cuándo y hasta cuándo hay movimiento: empieza en el primer motion y acaba en el último trazo. */
export function playbackRange(diagram: PathSource): { start: number; end: number } {
  const paths = diagram.assignments.filter(isPathAssignment);
  const start = Math.min(0, ...paths.map((path) => path.startTime));
  const end = Math.max(0, ...paths.map((path) => path.endTime));
  return { start, end };
}
