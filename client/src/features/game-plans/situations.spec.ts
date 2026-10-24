import { newId } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import type { GamePlanSituation } from '../../lib/api/types';
import {
  addPlay,
  addSituation,
  formatGameDate,
  move,
  movePlay,
  removePlay,
  removeSituation,
  renameSituation,
} from './situations';

const a = newId();
const b = newId();
const c = newId();

function plan(): GamePlanSituation[] {
  return [
    { id: 's1', name: '1st & 10', playIds: [a, b] },
    { id: 's2', name: 'Red zone', playIds: [] },
  ];
}

describe('situations', () => {
  it('mueve dentro de los límites', () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(move([1, 2, 3], 2, -2)).toEqual([3, 1, 2]);
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(move([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });

  it('añade, ordena y quita jugadas de una situación', () => {
    let situations = addPlay(plan(), 's1', c);
    expect(situations[0]?.playIds).toEqual([a, b, c]);
    // No se repite.
    expect(addPlay(situations, 's1', c)[0]?.playIds).toEqual([a, b, c]);
    situations = movePlay(situations, 's1', 2, -2);
    expect(situations[0]?.playIds).toEqual([c, a, b]);
    situations = removePlay(situations, 's1', a);
    expect(situations[0]?.playIds).toEqual([c, b]);
    expect(situations[1]?.playIds).toEqual([]);
  });

  it('añade, renombra y quita situaciones', () => {
    let situations = addSituation(plan(), 'Trick plays');
    expect(situations.map((s) => s.name)).toEqual(['1st & 10', 'Red zone', 'Trick plays']);
    situations = renameSituation(situations, 's2', 'Red zone (20-10)');
    expect(situations[1]?.name).toBe('Red zone (20-10)');
    expect(removeSituation(situations, 's1').map((s) => s.id)).toEqual(['s2', situations[2]?.id]);
  });

  it('formatea el día del partido sin correrlo por la zona horaria', () => {
    expect(formatGameDate('2026-11-07')).toMatch(/7 nov/);
    expect(formatGameDate(null)).toBeNull();
  });
});
