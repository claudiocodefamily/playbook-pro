import {
  FIELD_HALF_WIDTH_YARDS,
  newId,
  type DiagramPlayer,
  type FormationSlot,
  type PlayDiagram,
  type Point,
  type Position,
} from '@playbook/shared';

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

export function movePlayer(diagram: PlayDiagram, playerId: string, to: Point): PlayDiagram {
  const point = snapAndClamp(to);
  return {
    ...diagram,
    players: diagram.players.map((player) =>
      player.id === playerId ? { ...player, ...point } : player,
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

  let result: PlayDiagram = {
    ...diagram,
    players: [...diagram.players.filter((player) => player.side !== side), ...placed],
  };
  for (const leftover of available) {
    result = removePlayer(result, leftover.id);
  }
  return result;
}
