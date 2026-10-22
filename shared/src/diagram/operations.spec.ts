import { describe, expect, it } from 'vitest';
import type { FormationSlot } from '../formation.js';
import { newId } from '../ids.js';
import { createEmptyDiagram, PlayDiagramSchema, type PlayDiagram } from './diagram.schema.js';
import { cloneDiagramWithNewIds, createDiagramFromFormation } from './operations.js';

/** QB que da un handoff al RB, con un bloqueo del C sobre el nose tackle. */
function runPlay(): PlayDiagram {
  const qb = { id: newId(), side: 'O', position: 'QB', label: 'QB', x: 0, y: -2 } as const;
  const rb = { id: newId(), side: 'O', position: 'RB', label: 'RB', x: 0, y: -7 } as const;
  const c = { id: newId(), side: 'O', position: 'OL', label: 'C', x: 0, y: -1 } as const;
  const nose = { id: newId(), side: 'D', position: 'DL', label: 'N', x: 0, y: 1 } as const;
  return {
    ...createEmptyDiagram(),
    players: [qb, rb, c, nose],
    assignments: [
      {
        id: newId(),
        playerId: c.id,
        type: 'block',
        targetPlayerId: nose.id,
        points: [{ x: 0, y: 1 }],
        style: { line: 'solid', end: 'block', curved: false },
        startTime: 0,
        endTime: 2,
      },
    ],
    ball: {
      carrierTimeline: [
        { t: 0, playerId: qb.id, action: 'snap' },
        { t: 1, playerId: rb.id, action: 'handoff' },
      ],
    },
  };
}

describe('createDiagramFromFormation', () => {
  const slots: FormationSlot[] = [
    { slotId: 'C', position: 'OL', label: 'C', x: 0, y: -1 },
    { slotId: 'QB', position: 'QB', label: 'QB', x: 0, y: -5 },
  ];

  it('coloca un jugador por hueco, con ids nuevos y el lado de la unidad', () => {
    const diagram = createDiagramFromFormation(slots, 'offense');

    expect(PlayDiagramSchema.safeParse(diagram).success).toBe(true);
    expect(diagram.players).toMatchObject([
      { side: 'O', position: 'OL', label: 'C', x: 0, y: -1 },
      { side: 'O', position: 'QB', label: 'QB', x: 0, y: -5 },
    ]);
    expect(new Set(diagram.players.map((player) => player.id)).size).toBe(2);
  });

  it('pone en el lado D los jugadores de una formación defensiva', () => {
    const diagram = createDiagramFromFormation(slots, 'defense');
    expect(diagram.players.every((player) => player.side === 'D')).toBe(true);
  });
});

describe('cloneDiagramWithNewIds', () => {
  it('cambia todos los ids y mantiene las referencias entre jugadores', () => {
    const original = runPlay();
    const copy = cloneDiagramWithNewIds(original);

    expect(PlayDiagramSchema.safeParse(copy).success).toBe(true);

    const originalIds = new Set([
      ...original.players.map((player) => player.id),
      ...original.assignments.map((assignment) => assignment.id),
    ]);
    const copyIds = [
      ...copy.players.map((player) => player.id),
      ...copy.assignments.map((assignment) => assignment.id),
    ];
    expect(copyIds.some((id) => originalIds.has(id))).toBe(false);

    const labelOf = (diagram: PlayDiagram, id: string | undefined) =>
      diagram.players.find((player) => player.id === id)?.label;
    const block = copy.assignments[0];
    expect(block?.type).toBe('block');
    expect(labelOf(copy, block?.playerId)).toBe('C');
    expect(labelOf(copy, block && 'targetPlayerId' in block ? block.targetPlayerId : '')).toBe('N');
    expect(copy.ball.carrierTimeline.map((entry) => labelOf(copy, entry.playerId))).toEqual([
      'QB',
      'RB',
    ]);
  });

  it('no modifica el diagram original', () => {
    const original = runPlay();
    const snapshot = JSON.parse(JSON.stringify(original)) as PlayDiagram;
    cloneDiagramWithNewIds(original);
    expect(original).toEqual(snapshot);
  });
});
