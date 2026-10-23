import type { PlaybookSide } from '../enums.js';
import type { FormationSlot } from '../formation.js';
import { newId } from '../ids.js';
import { createEmptyDiagram, type DiagramPlayer, type PlayDiagram } from './diagram.schema.js';

/**
 * Lado de la cancha de una unidad. En special teams depende de la formación (ver
 * `formationSide`); sin formación se toma el equipo que patea (O).
 */
export function diagramSideFor(side: PlaybookSide): DiagramPlayer['side'] {
  return side === 'defense' ? 'D' : 'O';
}

/**
 * Lado de los jugadores de una formación. En special teams el equipo que patea es
 * siempre O (patea hacia y positivo) y el que recibe, D: se distingue porque las
 * formaciones de retorno están colocadas campo abajo (y > 0).
 */
export function formationSide(
  slots: readonly Pick<FormationSlot, 'y'>[],
  side: PlaybookSide,
): DiagramPlayer['side'] {
  if (side !== 'special' || slots.length === 0) return diagramSideFor(side);
  const meanY = slots.reduce((sum, slot) => sum + slot.y, 0) / slots.length;
  return meanY > 0 ? 'D' : 'O';
}

/** Diagram de una jugada nueva con los jugadores colocados según una formación. */
export function createDiagramFromFormation(
  slots: readonly FormationSlot[],
  side: PlaybookSide,
): PlayDiagram {
  return {
    ...createEmptyDiagram(),
    players: slots.map((slot) => ({
      id: newId(),
      side: formationSide(slots, side),
      position: slot.position,
      label: slot.label,
      x: slot.x,
      y: slot.y,
    })),
  };
}

/**
 * Copia un diagram dando ids nuevos a jugadores y asignaciones, y actualiza todas las
 * referencias entre ellos. Se usa al duplicar una jugada para que la copia no comparta ids.
 */
export function cloneDiagramWithNewIds(diagram: PlayDiagram): PlayDiagram {
  // El diagram es JSON puro, así que esta es una copia profunda completa.
  const copy = JSON.parse(JSON.stringify(diagram)) as PlayDiagram;
  const playerIds = new Map(copy.players.map((player) => [player.id, newId()]));
  // Una referencia rota no debería existir (el esquema la rechaza), pero si aparece se conserva.
  const mapPlayer = (id: string): string => playerIds.get(id) ?? id;

  for (const player of copy.players) {
    player.id = mapPlayer(player.id);
  }
  for (const assignment of copy.assignments) {
    assignment.id = newId();
    assignment.playerId = mapPlayer(assignment.playerId);
    if ('targetPlayerId' in assignment && assignment.targetPlayerId !== undefined) {
      assignment.targetPlayerId = mapPlayer(assignment.targetPlayerId);
    }
  }
  for (const entry of copy.ball.carrierTimeline) {
    if (entry.playerId !== undefined) entry.playerId = mapPlayer(entry.playerId);
  }
  return copy;
}
