import type { PlayDiagram } from '@playbook/shared';
import { type BallFlight, ballFlights, fullPlaybackRange } from './ball';
import { isPathAssignment } from './paths';

export interface PlayMoment {
  t: number;
  label: string;
}

const RELEASE_LABELS = {
  handoff: 'Handoff',
  pitch: 'Pitch',
  pass: 'Lanzamiento',
  kick: 'Patada',
  fumble: 'Fumble',
};
/** Dos momentos más cercanos que esto se juntan en uno. */
const SAME_MOMENT = 0.05;

/**
 * Los momentos clave de la jugada, para saltar de uno a otro al explicarla: el inicio
 * del motion, el snap, cada entrega o pase, cada recepción y los que haya marcado el
 * coach en `timeline.keyframes`.
 */
export function playMoments(
  diagram: PlayDiagram,
  flights: readonly BallFlight[] = ballFlights(diagram),
): PlayMoment[] {
  const range = fullPlaybackRange(diagram);
  const moments: PlayMoment[] = [];
  const motionStart = Math.min(
    0,
    ...diagram.assignments
      .filter(isPathAssignment)
      .filter((assignment) => assignment.type === 'motion')
      .map((assignment) => assignment.startTime),
  );
  if (motionStart < 0) moments.push({ t: motionStart, label: 'Motion' });
  moments.push({ t: 0, label: 'Snap' });
  for (const flight of flights) {
    if (flight.action === 'snap') continue;
    moments.push({ t: flight.releaseTime, label: RELEASE_LABELS[flight.action] });
    if (flight.action === 'pass' || flight.action === 'pitch') {
      moments.push({ t: flight.catchTime, label: 'Recepción' });
    } else if (flight.action === 'kick') {
      moments.push({
        t: flight.catchTime,
        label: flight.toPlayerId ? 'Recepción' : 'Cae el balón',
      });
    }
  }
  for (const keyframe of diagram.timeline.keyframes) moments.push(keyframe);
  if (range.end > 0) moments.push({ t: range.end, label: 'Final' });

  const sorted = moments
    .filter((moment) => moment.t >= range.start && moment.t <= Math.max(range.end, 0))
    .sort((a, b) => a.t - b.t);
  // Si dos caen en el mismo instante (el keyframe "Snap" y el snap), queda el primero.
  return sorted.filter(
    (moment, index) => index === 0 || moment.t - (sorted[index - 1]?.t ?? 0) > SAME_MOMENT,
  );
}

/** El momento siguiente (o anterior) a `t`; null si no hay más. */
export function adjacentMoment(
  moments: readonly PlayMoment[],
  t: number,
  direction: 1 | -1,
): PlayMoment | null {
  if (direction === 1) return moments.find((moment) => moment.t > t + SAME_MOMENT) ?? null;
  return moments.findLast((moment) => moment.t < t - SAME_MOMENT) ?? null;
}

/** Nombre del momento en el que está la animación, si está justo en uno. */
export function momentAt(moments: readonly PlayMoment[], t: number): PlayMoment | null {
  return moments.find((moment) => Math.abs(moment.t - t) <= SAME_MOMENT) ?? null;
}
