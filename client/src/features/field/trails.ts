import type { PlayDiagram, Point } from '@playbook/shared';
import { fullPlaybackRange } from './ball';
import { animatedPositions } from './coverage';

/** Cada cuánto se toma una muestra de la posición para dibujar la estela, en segundos. */
const SAMPLE_SECONDS = 0.05;

export interface TrailSamples {
  start: number;
  /** Posición de cada jugador en cada muestra, en orden de tiempo. */
  frames: Map<string, Point>[];
}

/** Muestrea toda la animación una vez, para no recalcularla en cada fotograma. */
export function sampleTrails(diagram: PlayDiagram): TrailSamples {
  const { start, end } = fullPlaybackRange(diagram);
  const frames: Map<string, Point>[] = [];
  for (let t = start; t <= end + 1e-9; t += SAMPLE_SECONDS) {
    frames.push(animatedPositions(diagram, t));
  }
  return { start, frames };
}

/**
 * El camino que ya recorrió cada jugador hasta el segundo `t`. Solo aparecen los que se
 * movieron; el último punto es su posición exacta en `t`.
 */
export function trailsAt(
  samples: TrailSamples,
  t: number,
  current: ReadonlyMap<string, Point>,
): Map<string, Point[]> {
  const count = Math.max(0, Math.floor((t - samples.start) / SAMPLE_SECONDS) + 1);
  const frames = samples.frames.slice(0, count);
  const trails = new Map<string, Point[]>();
  for (const [playerId, now] of current) {
    const points = frames.flatMap((frame) => {
      const point = frame.get(playerId);
      return point ? [point] : [];
    });
    points.push(now);
    const first = points[0];
    const moved =
      first && points.some((point) => Math.hypot(point.x - first.x, point.y - first.y) > 0.25);
    if (moved) trails.set(playerId, points);
  }
  return trails;
}
