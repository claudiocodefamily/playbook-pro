import { createEmptyDiagram, newId, type PlayDiagram } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { animatedPositions } from './coverage';

const X = newId();
const CB = newId();
const S = newId();
const style = { line: 'dashed', end: 'none', curved: false } as const;

/** El X corre un go de 15 yardas; el CB lo marca en man y el S está en zona profunda. */
function play(): PlayDiagram {
  return {
    ...createEmptyDiagram(),
    players: [
      { id: X, side: 'O', position: 'WR', label: 'X', x: -15, y: -1 },
      { id: CB, side: 'D', position: 'CB', label: 'CB', x: -14, y: 6 },
      { id: S, side: 'D', position: 'S', label: 'S', x: 0, y: 12 },
    ],
    assignments: [
      {
        id: newId(),
        playerId: X,
        type: 'route',
        points: [{ x: -15, y: 14 }],
        style: { line: 'solid', end: 'arrow', curved: false },
        startTime: 0,
        endTime: 2.5,
      },
      {
        id: newId(),
        playerId: CB,
        type: 'man',
        targetPlayerId: X,
        points: [],
        style,
        startTime: 0,
        endTime: 30,
      },
      {
        id: newId(),
        playerId: S,
        type: 'zone',
        points: [{ x: -12, y: 15 }],
        zone: { shape: 'ellipse', width: 16, depth: 12 },
        style,
        startTime: 0,
        endTime: 30,
      },
    ],
  };
}

describe('animatedPositions', () => {
  it('antes del snap la defensa no se mueve', () => {
    const positions = animatedPositions(play(), 0);
    expect(positions.get(CB)).toEqual({ x: -14, y: 6 });
    expect(positions.get(S)).toEqual({ x: 0, y: 12 });
  });

  it('el defensor en man sigue a su receptor y se le pega por el mismo lado', () => {
    const late = animatedPositions(play(), 5);
    const cb = late.get(CB);
    // El X acaba en (-15, 14); el CB, encima de él, por dentro y por delante.
    expect(cb?.x).toBeGreaterThan(-15);
    expect(cb?.y).toBeGreaterThan(14);
    expect(Math.hypot((cb?.x ?? 0) + 15, (cb?.y ?? 0) - 14)).toBeCloseTo(2.2);
  });

  it('el de zona cae hacia su zona y se acerca al receptor que entra', () => {
    const early = animatedPositions(play(), 0.5).get(S);
    // A 6 yardas por segundo, en medio segundo ha recorrido 3 yardas.
    expect(Math.hypot((early?.x ?? 0) - 0, (early?.y ?? 0) - 12)).toBeCloseTo(3);
    const late = animatedPositions(play(), 6).get(S);
    // El X entró en su zona: el safety se desplaza del centro (-12, 15) hacia él.
    expect(late?.x).toBeLessThan(-12);
  });
});
