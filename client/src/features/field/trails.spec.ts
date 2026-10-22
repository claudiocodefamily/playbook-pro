import { createEmptyDiagram, newId, type PlayDiagram } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { animatedPositions } from './coverage';
import { sampleTrails, trailsAt } from './trails';

const X = newId();
const C = newId();

function play(): PlayDiagram {
  return {
    ...createEmptyDiagram(),
    players: [
      { id: X, side: 'O', position: 'WR', label: 'X', x: -10, y: -1 },
      { id: C, side: 'O', position: 'OL', label: 'C', x: 0, y: -1 },
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
  };
}

describe('trailsAt', () => {
  it('dibuja solo a quien se movió, desde su inicio hasta donde está ahora', () => {
    const diagram = play();
    const samples = sampleTrails(diagram);
    const trails = trailsAt(samples, 1, animatedPositions(diagram, 1));
    expect(trails.has(C)).toBe(false);
    const trail = trails.get(X) ?? [];
    expect(trail[0]).toEqual({ x: -10, y: -1 });
    expect(trail.at(-1)).toEqual({ x: -10, y: 4 });
  });
});
