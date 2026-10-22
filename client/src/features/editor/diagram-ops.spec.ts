import {
  createEmptyDiagram,
  newId,
  PlayDiagramSchema,
  type FormationSlot,
  type PlayDiagram,
} from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { pathOrigins } from '../field/paths';
import {
  addBallTransfer,
  addPathAssignment,
  addPlayer,
  applyFormation,
  cleanPath,
  MAX_PER_SIDE,
  movePlayer,
  removeAssignment,
  removeBallEntry,
  removePlayer,
  setBallTime,
  setSnapReceiver,
  simplifyPath,
  snapAndClamp,
  updateAssignment,
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

  it('lleva consigo sus rutas sin cambiarles la forma', () => {
    const diagram = slant();
    const x = diagram.players.find((player) => player.label === 'X');
    const moved = movePlayer(diagram, x?.id ?? '', { x: -18, y: -1 });
    expect(moved.assignments[0]?.points).toEqual([{ x: -12, y: 6 }]);
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
    // La ruta viaja con el X al otro lado.
    expect(result.assignments[0]?.points).toEqual([{ x: 26, y: 6 }]);
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

describe('simplifyPath y cleanPath', () => {
  it('reduce un trazo a mano alzada a sus esquinas', () => {
    // Sube recto 5 yardas con temblor y gira 90 grados hacia fuera.
    const drawn = [
      { x: 0.1, y: 1 },
      { x: -0.1, y: 2 },
      { x: 0.05, y: 3 },
      { x: 0, y: 5 },
      { x: 2, y: 5.1 },
      { x: 4, y: 4.9 },
      { x: 6, y: 5 },
    ];
    expect(simplifyPath([{ x: 0, y: 0 }, ...drawn], 0.6)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 6, y: 5 },
    ]);
    expect(cleanPath({ x: 0, y: 0 }, drawn, 20)).toEqual([
      { x: 0, y: 5 },
      { x: 6, y: 5 },
    ]);
  });

  it('respeta el máximo de puntos', () => {
    const zigzag = Array.from({ length: 40 }, (_, i) => ({ x: i % 2 === 0 ? 0 : 3, y: i }));
    expect(cleanPath({ x: 0, y: -1 }, zigzag, 10).length).toBeLessThanOrEqual(10);
  });
});

describe('addPathAssignment', () => {
  function withX() {
    const diagram = applyFormation(createEmptyDiagram(), SLOTS, 'O');
    const x = diagram.players.find((player) => player.label === 'X');
    if (!x) throw new Error('falta el X');
    return { diagram, x };
  }

  it('crea una ruta válida que empieza en el snap', () => {
    const { diagram, x } = withX();
    const added = addPathAssignment(diagram, {
      playerId: x.id,
      type: 'route',
      points: [
        { x: -20, y: 5 },
        { x: -14, y: 11 },
      ],
    });
    if (!added) throw new Error('debería añadirse');
    const route = added.diagram.assignments.find((a) => a.id === added.assignmentId);
    expect(route).toMatchObject({ type: 'route', startTime: 0, style: { end: 'arrow' } });
    expect(route?.endTime).toBeGreaterThan(0);
    expect(PlayDiagramSchema.safeParse(added.diagram).success).toBe(true);
  });

  it('un toque sin arrastrar no crea nada', () => {
    const { diagram, x } = withX();
    expect(
      addPathAssignment(diagram, { playerId: x.id, type: 'route', points: [{ x: -20, y: -0.7 }] }),
    ).toBeNull();
  });

  it('la ruta sigue al motion: empieza donde acaba y después del snap', () => {
    const { diagram, x } = withX();
    const motion = addPathAssignment(diagram, {
      playerId: x.id,
      type: 'motion',
      points: [{ x: -10, y: -1 }],
    });
    if (!motion) throw new Error('debería añadirse el motion');
    const route = addPathAssignment(motion.diagram, {
      playerId: x.id,
      type: 'route',
      points: [{ x: -10, y: 8 }],
    });
    if (!route) throw new Error('debería añadirse la ruta');

    const [first, second] = route.diagram.assignments;
    expect(first).toMatchObject({ type: 'motion', endTime: 0, style: { line: 'dashed' } });
    expect(first?.startTime).toBeLessThan(0);
    expect(second?.startTime).toBe(0);
    expect(pathOrigins(route.diagram).get(second?.id ?? '')).toEqual({ x: -10, y: -1 });
    expect(PlayDiagramSchema.safeParse(route.diagram).success).toBe(true);
  });

  it('un motion nuevo sustituye al anterior', () => {
    const { diagram, x } = withX();
    const first = addPathAssignment(diagram, {
      playerId: x.id,
      type: 'motion',
      points: [{ x: -10, y: -1 }],
    });
    const second = first
      ? addPathAssignment(first.diagram, {
          playerId: x.id,
          type: 'motion',
          points: [{ x: -15, y: -3 }],
        })
      : null;
    expect(second?.diagram.assignments).toHaveLength(1);
    expect(second?.diagram.assignments[0]?.points).toEqual([{ x: -15, y: -3 }]);
  });
});

describe('updateAssignment y removeAssignment', () => {
  it('cambia estilo y nombre de ruta, y lo borra', () => {
    const diagram = slant();
    const id = diagram.assignments[0]?.id ?? '';
    const named = updateAssignment(diagram, id, {
      routeName: 'Slant',
      style: { line: 'dashed', end: 'none', curved: true },
    });
    expect(named.assignments[0]).toMatchObject({
      routeName: 'Slant',
      style: { line: 'dashed', end: 'none', curved: true },
    });
    const unnamed = updateAssignment(named, id, { routeName: '' });
    expect(unnamed.assignments[0]).not.toHaveProperty('routeName');
    expect(PlayDiagramSchema.safeParse(unnamed).success).toBe(true);
    expect(removeAssignment(unnamed, id).assignments).toEqual([]);
  });
});

describe('balón', () => {
  function withRoute() {
    const base = slant();
    const qb = base.players.find((player) => player.label === 'QB');
    const x = base.players.find((player) => player.label === 'X');
    const c = base.players.find((player) => player.label === 'C');
    if (!qb || !x || !c) throw new Error('faltan jugadores');
    return { diagram: { ...base, ball: { carrierTimeline: [] } }, qb, x, c };
  }

  it('sin snap no se puede pasar; con snap, el pase sale antes de que acabe la ruta', () => {
    const { diagram, qb, x } = withRoute();
    expect(addBallTransfer(diagram, x.id, 'pass')).toBeNull();

    const snapped = setSnapReceiver(diagram, qb.id);
    expect(addBallTransfer(snapped, qb.id, 'pass')).toBeNull();
    const passed = addBallTransfer(snapped, x.id, 'pass');
    expect(passed?.ball.carrierTimeline).toEqual([
      { t: 0, playerId: qb.id, action: 'snap' },
      { t: 0.9, playerId: x.id, action: 'pass' },
    ]);
    expect(PlayDiagramSchema.safeParse(passed).success).toBe(true);
  });

  it('cambiar quién recibe el snap quita el pase que iba a él mismo', () => {
    const { diagram, qb, x } = withRoute();
    const passed = addBallTransfer(setSnapReceiver(diagram, qb.id), x.id, 'pass');
    if (!passed) throw new Error('debería añadirse el pase');
    expect(setSnapReceiver(passed, x.id).ball.carrierTimeline).toEqual([
      { t: 0, playerId: x.id, action: 'snap' },
    ]);
  });

  it('el momento del pase no se adelanta al snap y quitar corta lo que venía después', () => {
    const { diagram, qb, x, c } = withRoute();
    const handoff = addBallTransfer(setSnapReceiver(diagram, qb.id), c.id, 'handoff');
    const pass = handoff ? addBallTransfer(handoff, x.id, 'pass') : null;
    if (!pass) throw new Error('deberían añadirse');
    expect(setBallTime(pass, 1, -3).ball.carrierTimeline[1]?.t).toBe(0.4);
    expect(setBallTime(pass, 0, 3)).toBe(pass);
    expect(removeBallEntry(pass, 1).ball.carrierTimeline).toHaveLength(1);
  });
});
