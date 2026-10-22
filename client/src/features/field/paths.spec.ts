import { createEmptyDiagram, newId, type PlayDiagram } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { pathLength, playbackRange, pointAlong, positionsAt } from './paths';

const X = newId();
const C = newId();

/** El X hace motion de -20 a -10 antes del snap y luego sube 10 yardas. */
function play(): PlayDiagram {
  return {
    ...createEmptyDiagram(),
    players: [
      { id: X, side: 'O', position: 'WR', label: 'X', x: -20, y: -1 },
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
      {
        id: newId(),
        playerId: X,
        type: 'motion',
        points: [{ x: -10, y: -1 }],
        style: { line: 'dashed', end: 'arrow', curved: false },
        startTime: -2,
        endTime: 0,
      },
    ],
  };
}

describe('pathLength y pointAlong', () => {
  it('mide el recorrido y encuentra el punto a una fracción de él', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
      { x: 4, y: 4 },
    ];
    expect(pathLength(path)).toBe(8);
    expect(pointAlong(path, 0.25)).toEqual({ x: 0, y: 2 });
    expect(pointAlong(path, 0.75)).toEqual({ x: 2, y: 4 });
    expect(pointAlong(path, 2)).toEqual({ x: 4, y: 4 });
  });
});

describe('positionsAt', () => {
  it('sigue el motion antes del snap y la ruta después', () => {
    const diagram = play();
    expect(positionsAt(diagram, -3).get(X)).toEqual({ x: -20, y: -1 });
    expect(positionsAt(diagram, -1).get(X)).toEqual({ x: -15, y: -1 });
    expect(positionsAt(diagram, 0).get(X)).toEqual({ x: -10, y: -1 });
    expect(positionsAt(diagram, 1).get(X)).toEqual({ x: -10, y: 4 });
    expect(positionsAt(diagram, 5).get(X)).toEqual({ x: -10, y: 9 });
    // Quien no tiene trazos se queda quieto.
    expect(positionsAt(diagram, 1).get(C)).toEqual({ x: 0, y: -1 });
  });
});

describe('playbackRange', () => {
  it('va del primer motion al final del último trazo', () => {
    expect(playbackRange(play())).toEqual({ start: -2, end: 2 });
    expect(playbackRange(createEmptyDiagram())).toEqual({ start: 0, end: 0 });
  });
});
