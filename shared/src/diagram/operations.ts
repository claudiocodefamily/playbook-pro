import type { PlaybookSide } from '../enums.js';
import type { FormationSlot } from '../formation.js';
import { newId } from '../ids.js';
import { createEmptyDiagram, type DiagramPlayer, type PlayDiagram } from './diagram.schema.js';

/**
 * Lado de la cancha de los jugadores de una formación. Las de special teams se dibujan
 * como el equipo que patea (O); el editor podrá cambiarlo jugador a jugador.
 */
export function diagramSideFor(side: PlaybookSide): DiagramPlayer['side'] {
  return side === 'defense' ? 'D' : 'O';
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
      side: diagramSideFor(side),
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
    entry.playerId = mapPlayer(entry.playerId);
  }
  return copy;
}
