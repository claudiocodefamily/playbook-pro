import type { PlayDiagram, Point } from '@playbook/shared';
import { playbackRange, positionsAt } from './paths';

export type BallEntry = PlayDiagram['ball']['carrierTimeline'][number];
export type BallAction = NonNullable<BallEntry['action']>;

/** Velocidad del balón en el aire, en yardas por segundo. */
const SPEED: Readonly<Record<BallAction, number>> = {
  snap: 12,
  handoff: 6,
  pitch: 10,
  pass: 18,
  fumble: 5,
};
/** Un handoff es mano a mano: dura lo mismo esté donde esté el RB. */
const HANDOFF_SECONDS = 0.25;
const MIN_FLIGHT_SECONDS = 0.2;

/** Entradas del balón en orden de tiempo. */
export function ballEntries(diagram: Pick<PlayDiagram, 'ball'>): BallEntry[] {
  return [...diagram.ball.carrierTimeline].sort((a, b) => a.t - b.t);
}

/**
 * Dónde está el balón antes del snap: en la LOS, delante del center (el OL más centrado
 * del ataque). Sin línea ofensiva, en el centro del campo.
 */
export function snapSpot(diagram: Pick<PlayDiagram, 'players'>): Point {
  const linemen = diagram.players.filter(
    (player) => player.side === 'O' && player.position === 'OL',
  );
  const center = linemen.sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
  return { x: center?.x ?? 0, y: 0 };
}

export interface BallFlight {
  action: BallAction;
  toPlayerId: string;
  /** Cuándo sale el balón y desde dónde. */
  releaseTime: number;
  from: Point;
  /** Cuándo llega y dónde lo recibe el jugador (en su ruta, no donde estaba al soltarlo). */
  catchTime: number;
  to: Point;
}

/**
 * Cada vez que el balón cambia de manos. El punto de recepción se calcula sobre la ruta
 * del receptor: el balón va a donde estará el jugador cuando llegue, no a donde está.
 */
export function ballFlights(diagram: PlayDiagram): BallFlight[] {
  const flights: BallFlight[] = [];
  let holder: string | null = null;
  let lastCatch = Number.NEGATIVE_INFINITY;
  for (const entry of ballEntries(diagram)) {
    const action = entry.action ?? 'handoff';
    // Si aún no ha llegado el balón anterior, sale en cuanto llegue.
    const releaseTime = Math.max(entry.t, lastCatch);
    const from = holder
      ? (positionsAt(diagram, releaseTime).get(holder) ?? snapSpot(diagram))
      : snapSpot(diagram);
    const receiverAt = (t: number) => positionsAt(diagram, t).get(entry.playerId) ?? from;
    let to = receiverAt(releaseTime);
    let duration = flightSeconds(action, from, to);
    // Unas pocas iteraciones bastan para que el punto de recepción converja.
    for (let i = 0; i < 4; i++) {
      to = receiverAt(releaseTime + duration);
      duration = flightSeconds(action, from, to);
    }
    flights.push({
      action,
      toPlayerId: entry.playerId,
      releaseTime,
      from,
      catchTime: releaseTime + duration,
      to,
    });
    holder = entry.playerId;
    lastCatch = releaseTime + duration;
  }
  return flights;
}

function flightSeconds(action: BallAction, from: Point, to: Point): number {
  if (action === 'handoff') return HANDOFF_SECONDS;
  return Math.max(MIN_FLIGHT_SECONDS, Math.hypot(to.x - from.x, to.y - from.y) / SPEED[action]);
}

export interface BallState {
  position: Point;
  /** De 0 a 1: altura del balón en el aire (0 en las manos o en el suelo). */
  height: number;
  /** Quién lo tiene, o null si está en el suelo o en el aire. */
  holderId: string | null;
}

/** Estado del balón en el segundo `t`. */
export function ballAt(diagram: PlayDiagram, t: number, flights = ballFlights(diagram)): BallState {
  let holderId: string | null = null;
  for (const flight of flights) {
    if (t < flight.releaseTime) break;
    if (t < flight.catchTime) {
      const fraction = (t - flight.releaseTime) / (flight.catchTime - flight.releaseTime);
      return {
        position: {
          x: flight.from.x + (flight.to.x - flight.from.x) * fraction,
          y: flight.from.y + (flight.to.y - flight.from.y) * fraction,
        },
        // Los pases van en arco; el snap y el pitch, casi rasos.
        height: Math.sin(Math.PI * fraction) * (flight.action === 'pass' ? 1 : 0.3),
        holderId: null,
      };
    }
    holderId = flight.toPlayerId;
  }
  const position = holderId
    ? (positionsAt(diagram, t).get(holderId) ?? snapSpot(diagram))
    : snapSpot(diagram);
  return { position, height: 0, holderId };
}

/** Rango de la animación contando también el balón (hasta un poco después de la recepción). */
export function fullPlaybackRange(diagram: PlayDiagram): { start: number; end: number } {
  const range = playbackRange(diagram);
  const lastCatch = ballFlights(diagram).at(-1)?.catchTime;
  return lastCatch === undefined
    ? range
    : { start: range.start, end: Math.max(range.end, lastCatch + 0.6) };
}
