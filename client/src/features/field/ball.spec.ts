import { createEmptyDiagram, newId, type PlayDiagram } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { ballAt, ballFlights, fullPlaybackRange, snapSpot } from './ball';

const C = newId();
const QB = newId();
const X = newId();

/** Shotgun mínimo: el C da el snap al QB y el QB lanza al X, que corre 10 yardas rectas. */
function play(): PlayDiagram {
  return {
    ...createEmptyDiagram(),
    players: [
      { id: C, side: 'O', position: 'OL', label: 'C', x: 0.5, y: -1 },
      { id: QB, side: 'O', position: 'QB', label: 'QB', x: 0.5, y: -5 },
      { id: X, side: 'O', position: 'WR', label: 'X', x: -10, y: -1 },
    ],
    assignments: [
      {
        id: newId(),
        playerId: X,
        type: 'route',
        points: [{ x: -10, y: 9 }],
        style: { line: 'solid', end: 'arrow', curved: false },
        startTime: 0,
        endTime: 2,
      },
    ],
    ball: {
      carrierTimeline: [
        { t: 1, playerId: X, action: 'pass' },
        { t: 0, playerId: QB, action: 'snap' },
      ],
    },
  };
}

describe('snapSpot', () => {
  it('pone el balón en la LOS delante del center', () => {
    expect(snapSpot(play())).toEqual({ x: 0.5, y: 0 });
    expect(snapSpot(createEmptyDiagram())).toEqual({ x: 0, y: 0 });
  });
});

describe('ballFlights', () => {
  it('ordena por tiempo y lanza a donde estará el receptor al llegar el balón', () => {
    const [snap, pass] = ballFlights(play());
    expect(snap).toMatchObject({ action: 'snap', toPlayerId: QB, from: { x: 0.5, y: 0 } });
    expect(snap?.to).toEqual({ x: 0.5, y: -5 });
    expect(pass?.action).toBe('pass');
    expect(pass?.releaseTime).toBe(1);
    // Al soltar, el X está en la yarda 4; el balón llega más arriba en su ruta.
    expect(pass?.to.x).toBe(-10);
    expect(pass?.to.y).toBeGreaterThan(4);
    expect(pass?.catchTime).toBeGreaterThan(1);
  });
});

describe('ballAt', () => {
  it('está en el suelo antes del snap, en manos del QB y en el aire durante el pase', () => {
    const diagram = play();
    expect(ballAt(diagram, -1)).toMatchObject({ holderId: null, height: 0 });
    expect(ballAt(diagram, 0.8)).toMatchObject({ holderId: QB, position: { x: 0.5, y: -5 } });
    const flying = ballAt(diagram, 1.3);
    expect(flying.holderId).toBeNull();
    expect(flying.height).toBeGreaterThan(0);
    expect(ballAt(diagram, 5)).toMatchObject({ holderId: X, position: { x: -10, y: 9 } });
  });
});

describe('fullPlaybackRange', () => {
  it('alarga la animación hasta después de la recepción', () => {
    const diagram = play();
    const lastCatch = ballFlights(diagram).at(-1)?.catchTime ?? 0;
    expect(fullPlaybackRange(diagram).end).toBeCloseTo(Math.max(2, lastCatch + 0.6));
  });
});
