import type { Assignment, PlayDiagram, Point } from '@playbook/shared';
import { isPathAssignment, playbackRange, positionsAt } from './paths';

export type ManAssignment = Extract<Assignment, { type: 'man' }>;
export type ZoneAssignment = Extract<Assignment, { type: 'zone' }>;
export type CoverageAssignment = ManAssignment | ZoneAssignment;

export function isCoverage(assignment: Assignment): assignment is CoverageAssignment {
  return assignment.type === 'man' || assignment.type === 'zone';
}

/** Retraso con el que un defensor en man copia los movimientos de su receptor. */
const MAN_LAG = 0.35;
/** Segundos que tarda en pasar de su colocación inicial a su distancia de marcaje. */
const MAN_SETTLE = 1.2;
/** Distancia máxima a la que se queda de su receptor, en yardas. */
const MAN_CUSHION = 2.2;
/** Velocidad del drop hacia la zona, en yardas por segundo. */
const ZONE_SPEED = 6;
/** Cuánto se desplaza hacia el receptor que entra en su zona (0 = nada, 1 = encima). */
const ZONE_SHADE = 0.6;

/**
 * Posición de todos los jugadores en el segundo `t`, con la defensa reaccionando: el
 * defensor en man sigue a su receptor (también en el motion antes del snap) y el de zona
 * cae a su zona tras el snap y se desplaza hacia el receptor que entra en ella. Un
 * jugador con trazos (por ejemplo, un blitz) sigue sus trazos.
 */
export function animatedPositions(diagram: PlayDiagram, t: number): Map<string, Point> {
  const positions = positionsAt(diagram, t);
  const withPaths = new Set(
    diagram.assignments.filter(isPathAssignment).map((assignment) => assignment.playerId),
  );
  const start = playbackRange(diagram).start;

  for (const coverage of diagram.assignments.filter(isCoverage)) {
    if (withPaths.has(coverage.playerId)) continue;
    const defender = diagram.players.find((player) => player.id === coverage.playerId);
    if (!defender) continue;
    const position =
      coverage.type === 'man'
        ? manPosition(diagram, defender, coverage, t, start)
        : zonePosition(diagram, defender, coverage, t, positions);
    if (position) positions.set(defender.id, position);
  }
  return positions;
}

function manPosition(
  diagram: PlayDiagram,
  defender: Point,
  coverage: ManAssignment,
  t: number,
  start: number,
): Point | null {
  const target = diagram.players.find((player) => player.id === coverage.targetPlayerId);
  if (!target || t <= start) return null;
  const followed = positionsAt(diagram, Math.max(start, t - MAN_LAG)).get(target.id) ?? target;
  // Mantiene el lado (inside, outside, profundo) por el que empezó, pero más pegado.
  const offset = { x: defender.x - target.x, y: defender.y - target.y };
  const length = Math.hypot(offset.x, offset.y);
  const cushion =
    length === 0
      ? offset
      : {
          x: (offset.x / length) * Math.min(length, MAN_CUSHION),
          y: (offset.y / length) * Math.min(length, MAN_CUSHION),
        };
  const settle = Math.min(1, (t - start) / MAN_SETTLE);
  const y = followed.y + offset.y + (cushion.y - offset.y) * settle;
  return {
    x: followed.x + offset.x + (cushion.x - offset.x) * settle,
    // Si juega por delante (off coverage), no se acerca a la LOS: espera al receptor.
    y: offset.y > 0 ? Math.max(y, defender.y) : y,
  };
}

function zonePosition(
  diagram: PlayDiagram,
  defender: Point,
  coverage: ZoneAssignment,
  t: number,
  positions: ReadonlyMap<string, Point>,
): Point | null {
  const center = coverage.points[0];
  if (!center || t <= 0) return null;
  // Se desplaza hacia el receptor más cercano que esté dentro de su zona.
  const halfWidth = coverage.zone.width / 2;
  const halfDepth = coverage.zone.depth / 2;
  let goal = center;
  let closest = Number.POSITIVE_INFINITY;
  for (const player of diagram.players) {
    if (player.side !== 'O') continue;
    const at = positions.get(player.id) ?? player;
    const nx = (at.x - center.x) / halfWidth;
    const ny = (at.y - center.y) / halfDepth;
    const reach = nx * nx + ny * ny;
    const distance = Math.hypot(at.x - center.x, at.y - center.y);
    if (reach < 1 && distance < closest) {
      closest = distance;
      // Cuanto más dentro de la zona, más se desplaza: sin saltos al cruzar el borde.
      const weight = Math.min(1, (1 - reach) * 3) * ZONE_SHADE;
      goal = {
        x: center.x + (at.x - center.x) * weight,
        y: center.y + (at.y - center.y) * weight,
      };
    }
  }
  const dx = goal.x - defender.x;
  const dy = goal.y - defender.y;
  const distance = Math.hypot(dx, dy);
  const travelled = Math.min(distance, ZONE_SPEED * t);
  if (distance === 0) return goal;
  return {
    x: defender.x + (dx / distance) * travelled,
    y: defender.y + (dy / distance) * travelled,
  };
}
