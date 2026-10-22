import {
  createEmptyDiagram,
  newId,
  PlayDiagramSchema,
  type FormationSlot,
  type PlayDiagram,
} from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  applyFormation,
  MAX_PER_SIDE,
  movePlayer,
  removePlayer,
  snapAndClamp,
  updatePlayer,
} from './diagram-ops';

const SLOTS: FormationSlot[] = [
  { slotId: 'C', position: 'OL', label: 'C', x: 0, y: -1 },
  { slotId: 'QB', position: 'QB', label: 'QB', x: 0, y: -5 },
  { slotId: 'X', position: 'WR', label: 'X', x: -20, y: -1 },
];

/** Jugada con un X que corre un slant y es el receptor del pase. */
function slant(): PlayDiagram {
  const diagram = applyFormation(createEmptyDiagram(), SLOTS, 'O');
  const qb = diagram.players.find((player) => player.label === 'QB');
  const x = diagram.players.find((player) => player.label === 'X');
  if (!qb || !x) throw new Error('faltan jugadores');
  return {
    ...diagram,
    assignments: [
      {
        id: newId(),
        playerId: x.id,
        type: 'route',
        points: [{ x: -14, y: 6 }],
        style: { line: 'solid', end: 'arrow', curved: false },
        startTime: 0,
        endTime: 1.5,
      },
    ],
    ball: {
      carrierTimeline: [
        { t: 0, playerId: qb.id, action: 'snap' },
        { t: 1.5, playerId: x.id, action: 'pass' },
      ],
    },
  };
}

describe('snapAndClamp', () => {
  it('ajusta a la media yarda y no deja salir del campo', () => {
    expect(snapAndClamp({ x: 3.3, y: -4.8 })).toEqual({ x: 3.5, y: -5 });
    expect(snapAndClamp({ x: 40, y: -50 })).toEqual({ x: 160 / 3 / 2, y: -20 });
  });
});

describe('movePlayer', () => {
  it('mueve solo al jugador indicado', () => {
    const diagram = slant();
    const [first, second] = diagram.players;
    const moved = movePlayer(diagram, first?.id ?? '', { x: 2.2, y: -3.1 });
    expect(moved.players[0]).toMatchObject({ x: 2, y: -3 });
    expect(moved.players[1]).toEqual(second);
  });
});

describe('removePlayer', () => {
  it('quita también sus rutas y su paso por el balón, y el diagram sigue siendo válido', () => {
    const diagram = slant();
    const x = diagram.players.find((player) => player.label === 'X');
    const result = removePlayer(diagram, x?.id ?? '');
    expect(result.players.map((player) => player.label)).toEqual(['C', 'QB']);
    expect(result.assignments).toEqual([]);
    expect(result.ball.carrierTimeline).toHaveLength(1);
    expect(PlayDiagramSchema.safeParse(result).success).toBe(true);
  });
});

describe('addPlayer', () => {
  it(`no deja pasar de ${MAX_PER_SIDE} jugadores por lado`, () => {
    let diagram = createEmptyDiagram();
    for (let i = 0; i < MAX_PER_SIDE; i++) {
      const added = addPlayer(diagram, {
        side: 'D',
        position: 'LB',
        label: 'LB',
        at: { x: i, y: 5 },
      });
      if (!added) throw new Error('debería caber');
      diagram = added.diagram;
    }
    expect(
      addPlayer(diagram, { side: 'D', position: 'LB', label: 'LB', at: { x: 0, y: 5 } }),
    ).toBeNull();
    expect(
      addPlayer(diagram, { side: 'O', position: 'QB', label: 'QB', at: { x: 0, y: -5 } }),
    ).not.toBeNull();
  });
});

describe('applyFormation', () => {
  it('reutiliza los jugadores existentes y conserva sus rutas', () => {
    const diagram = slant();
    const xBefore = diagram.players.find((player) => player.label === 'X');
    const flipped = SLOTS.map((slot) => ({ ...slot, x: -slot.x }));

    const result = applyFormation(diagram, flipped, 'O');

    const xAfter = result.players.find((player) => player.label === 'X');
    expect(xAfter?.id).toBe(xBefore?.id);
    expect(xAfter).toMatchObject({ x: 20, y: -1 });
    expect(result.assignments).toHaveLength(1);
    expect(PlayDiagramSchema.safeParse(result).success).toBe(true);
  });

  it('quita a los que no caben en la nueva formación y no toca al otro lado', () => {
    const withDefense = addPlayer(slant(), {
      side: 'D',
      position: 'CB',
      label: 'CB',
      at: { x: -20, y: 7 },
    });
    if (!withDefense) throw new Error('debería caber');

    const result = applyFormation(withDefense.diagram, [SLOTS[1] as FormationSlot], 'O');

    expect(result.players.map((player) => player.label).sort()).toEqual(['CB', 'QB']);
    expect(result.assignments).toEqual([]);
    expect(PlayDiagramSchema.safeParse(result).success).toBe(true);
  });
});

describe('updatePlayer', () => {
  it('cambia la etiqueta y pone o quita el dorsal', () => {
    const diagram = slant();
    const id = diagram.players[0]?.id ?? '';

    const numbered = updatePlayer(diagram, id, { label: 'OC', number: 55 });
    expect(numbered.players[0]).toMatchObject({ label: 'OC', number: 55 });

    const cleared = updatePlayer(numbered, id, { number: undefined });
    expect(cleared.players[0]).not.toHaveProperty('number');
    expect(cleared.players[0]?.label).toBe('OC');
  });
});
