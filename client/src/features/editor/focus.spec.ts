import { createEmptyDiagram, newId, type PlayDiagram } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { describeAssignments, focusedIds, positionFocus } from './focus';

const QB = newId();
const X = newId();
const LT = newId();
const LG = newId();
const N = newId();
const solid = { line: 'solid', end: 'arrow', curved: false } as const;

function play(): PlayDiagram {
  return {
    ...createEmptyDiagram(),
    players: [
      { id: QB, side: 'O', position: 'QB', label: 'QB', x: 0, y: -5 },
      { id: X, side: 'O', position: 'WR', label: 'X', x: -20, y: -1 },
      { id: LT, side: 'O', position: 'OL', label: 'LT', x: -4, y: -1 },
      { id: LG, side: 'O', position: 'OL', label: 'LG', x: -2, y: -1 },
      { id: N, side: 'D', position: 'DL', label: 'N', x: 0, y: 1 },
    ],
    assignments: [
      {
        id: newId(),
        playerId: X,
        type: 'motion',
        points: [{ x: -10, y: -1 }],
        style: { ...solid, line: 'dashed' },
        startTime: -2,
        endTime: 0,
      },
      {
        id: newId(),
        playerId: X,
        type: 'route',
        routeName: 'Slant',
        points: [{ x: -6, y: 5 }],
        style: solid,
        startTime: 0,
        endTime: 1.5,
      },
      {
        id: newId(),
        playerId: LG,
        type: 'block',
        targetPlayerId: N,
        points: [{ x: 0, y: 1 }],
        style: { ...solid, end: 'block' },
        startTime: 0,
        endTime: 3,
      },
    ],
    ball: {
      carrierTimeline: [
        { t: 0, playerId: QB, action: 'snap' },
        { t: 1.5, playerId: X, action: 'pass' },
      ],
    },
  };
}

describe('focusedIds', () => {
  it('sin modo jugador no resalta a nadie', () => {
    expect(focusedIds(play(), null)).toBeNull();
  });

  it('resalta a un jugador o a todos los de una posición', () => {
    expect(focusedIds(play(), X)).toEqual(new Set([X]));
    expect(focusedIds(play(), positionFocus('OL'))).toEqual(new Set([LT, LG]));
  });

  it('si el jugador ya no está, vuelve a enseñar a todos', () => {
    expect(focusedIds(play(), newId())).toBeNull();
    expect(focusedIds(play(), positionFocus('TE'))).toBeNull();
  });
});

describe('describeAssignments', () => {
  it('explica la tarea del receptor en orden de tiempo', () => {
    expect(describeAssignments(play(), X)).toEqual([
      'Motion antes del snap (-2.0 s)',
      'Ruta Slant, de 0.0 s a 1.5 s',
      expect.stringMatching(/^Recibe el pase \(\d\.\d s\)$/),
    ]);
  });

  it('explica el bloqueo asignado y lo que hace el QB con el balón', () => {
    expect(describeAssignments(play(), LG)).toEqual(['Bloquea a N, de 0.0 s a 3.0 s']);
    expect(describeAssignments(play(), QB)).toEqual([
      expect.stringMatching(/^Recibe el snap/),
      'Lanza a X (1.5 s)',
    ]);
  });

  it('un jugador sin tarea no tiene frases', () => {
    expect(describeAssignments(play(), LT)).toEqual([]);
  });
});
