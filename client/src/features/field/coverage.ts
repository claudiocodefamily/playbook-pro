import type { Assignment, PlayDiagram, Point } from '@playbook/shared';
import { isPathAssignment, isTargetedBlock, playbackRange, positionsAt } from './paths';

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
/** Distancia a la que el bloqueador se queda del jugador que bloquea (contacto), en yardas. */
const BLOCK_CONTACT = 1.4;
/** Velocidad con la que el bloqueador llega al contacto, en yardas por segundo. */
const BLOCK_SPEED = 5;
/** Retraso con el que el bloqueador reacciona a los movimientos del rival. */
const BLOCK_LAG = 0.15;

/**
 * Posición de todos los jugadores en el segundo `t`, con los jugadores reaccionando unos a
 * otros: el defensor en man sigue a su receptor, el de zona cae a su zona y se desplaza
 * hacia el receptor que entra en ella, y el que tiene un bloqueo asignado sigue al rival
 * que bloquea (también si ese rival hace un blitz, un slant o cubre a alguien).
 */
export function animatedPositions(diagram: PlayDiagram, t: number): Map<string, Point> {
  const positions = coveragePositions(diagram, t);
  for (const block of diagram.assignments.filter(isTargetedBlock)) {
    if (t <= block.startTime) continue;
    const position = blockPosition(diagram, block.playerId, block.targetPlayerId, block, t);
    if (position) positions.set(block.playerId, position);
  }
  return positions;
}

/**
 * El bloqueador sale de donde está al empezar el bloqueo, llega al contacto con el rival por
 * el lado por el que lo encara y, desde ahí, lo acompaña a donde vaya (lo espeja). Al
 * terminar el bloqueo se queda donde estaba.
 */
function blockPosition(
  diagram: PlayDiagram,
  blockerId: string,
  targetId: string,
  timing: { startTime: number; endTime: number },
  t: number,
): Point | null {
  const start = timing.startTime;
  const now = Math.min(t, Math.max(start, timing.endTime));
  const atStart = coveragePositions(diagram, start);
  const blocker = atStart.get(blockerId);
  const target = atStart.get(targetId);
  if (!blocker || !target) return null;
  const offset = { x: blocker.x - target.x, y: blocker.y - target.y };
  const length = Math.hypot(offset.x, offset.y);
  // Si empiezan encima, se coloca delante del rival mirando a su propio campo.
  const contact =
    length === 0
      ? {
          x: 0,
          y: diagram.players.find((player) => player.id === blockerId)?.side === 'D' ? 1 : -1,
        }
      : { x: offset.x / length, y: offset.y / length };
  const settleSeconds = Math.max(0.3, (length - BLOCK_CONTACT) / BLOCK_SPEED);
  const settle = Math.min(1, (now - start) / settleSeconds);
  const followed =
    coveragePositions(diagram, Math.max(start, now - BLOCK_LAG)).get(targetId) ?? target;
  const gap = length + (BLOCK_CONTACT - length) * settle;
  return { x: followed.x + contact.x * gap, y: followed.y + contact.y * gap };
}

/** Posiciones con la cobertura de la defensa aplicada (sin los bloqueos asignados). */
function coveragePositions(diagram: PlayDiagram, t: number): Map<string, Point> {
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
