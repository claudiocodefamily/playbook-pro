import { PLAYBOOK_SIDES } from '@playbook/shared';
import { GLOBAL_CONCEPTS } from './concepts.seed.js';

describe('GLOBAL_CONCEPTS', () => {
  it('no repite nombres', () => {
    const names = GLOBAL_CONCEPTS.map(({ name }) => name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(PLAYBOOK_SIDES)('tiene conceptos de %s', (side) => {
    expect(GLOBAL_CONCEPTS.filter((concept) => concept.side === side).length).toBeGreaterThan(2);
  });

  it.each(GLOBAL_CONCEPTS)('$name cabe en los límites del esquema', ({ name, explanation }) => {
    expect(name.length).toBeLessThanOrEqual(60);
    expect(explanation.length).toBeGreaterThan(40);
    expect(explanation.length).toBeLessThanOrEqual(2000);
  });
});
