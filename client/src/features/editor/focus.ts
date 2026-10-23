import type { PlayDiagram, Position } from '@playbook/shared';
import { type BallAction, ballFlights } from '../field/ball';
import { isCoverage } from '../field/coverage';
import { isPathAssignment, isTargetedBlock } from '../field/paths';

/**
 * Modo jugador: a quién se resalta en la cancha. Un jugador concreto (su id) o todos los
 * de una posición ("pos:OL"); null enseña a todos por igual.
 */
export type Focus = string | null;

const POSITION_PREFIX = 'pos:';

export function positionFocus(position: Position): string {
  return `${POSITION_PREFIX}${position}`;
}

/** Los jugadores resaltados, o null si no hay modo jugador (o el jugador ya no está). */
export function focusedIds(
  diagram: Pick<PlayDiagram, 'players'>,
  focus: Focus,
): Set<string> | null {
  if (!focus) return null;
  const ids = focus.startsWith(POSITION_PREFIX)
    ? diagram.players
        .filter((player) => player.position === focus.slice(POSITION_PREFIX.length))
        .map((player) => player.id)
    : diagram.players.filter((player) => player.id === focus).map((player) => player.id);
  return ids.length > 0 ? new Set(ids) : null;
}

const seconds = (t: number) => `${t.toFixed(1)} s`;

const RECEIVES: Readonly<Record<BallAction, string>> = {
  snap: 'Recibe el snap',
  handoff: 'Recibe el handoff',
  pitch: 'Recibe el pitch',
  pass: 'Recibe el pase',
  kick: 'Recibe la patada',
  fumble: 'Recoge el fumble',
};

const RELEASES: Readonly<Record<BallAction, string>> = {
  snap: 'Snap',
  handoff: 'Entrega',
  pitch: 'Pitch',
  pass: 'Lanza',
  kick: 'Patea',
  fumble: 'Fumble',
};

/**
 * La tarea de un jugador explicada en frases cortas, en orden de tiempo: lo que lee un
 * jugador para saber qué tiene que hacer en la jugada.
 */
export function describeAssignments(diagram: PlayDiagram, playerId: string): string[] {
  const labelOf = (id: string | undefined) =>
    diagram.players.find((player) => player.id === id)?.label ?? '?';
  const steps: { t: number; text: string }[] = [];

  for (const assignment of diagram.assignments) {
    if (assignment.playerId !== playerId) continue;
    if (isCoverage(assignment)) {
      steps.push({
        t: 0,
        text:
          assignment.type === 'man'
            ? `Marcaje al hombre (man) a ${labelOf(assignment.targetPlayerId)}`
            : `Zona${assignment.zone.name ? ` ${assignment.zone.name}` : ''}: cae a su zona tras el snap`,
      });
      continue;
    }
    if (!isPathAssignment(assignment)) continue;
    const when =
      assignment.type === 'motion'
        ? `antes del snap (${seconds(assignment.startTime)})`
        : `de ${seconds(assignment.startTime)} a ${seconds(assignment.endTime)}`;
    const text =
      assignment.type === 'route'
        ? `Ruta${assignment.routeName ? ` ${assignment.routeName}` : ''}, ${when}`
        : assignment.type === 'motion'
          ? `Motion ${when}`
          : assignment.type === 'blitz'
            ? `Blitz ${when}`
            : isTargetedBlock(assignment)
              ? `Bloquea a ${labelOf(assignment.targetPlayerId)}, ${when}`
              : `Bloqueo, ${when}`;
    steps.push({ t: assignment.startTime, text });
  }

  let holder: string | null = null;
  for (const flight of ballFlights(diagram)) {
    if (flight.toPlayerId === playerId) {
      steps.push({
        t: flight.catchTime,
        text: `${RECEIVES[flight.action]} (${seconds(flight.catchTime)})`,
      });
    } else if (holder === playerId && flight.action !== 'snap') {
      const to = flight.toPlayerId ? ` a ${labelOf(flight.toPlayerId)}` : '';
      steps.push({
        t: flight.releaseTime,
        text: `${RELEASES[flight.action]}${to} (${seconds(flight.releaseTime)})`,
      });
    }
    holder = flight.toPlayerId;
  }

  return steps.sort((a, b) => a.t - b.t).map((step) => step.text);
}
