import { createEmptyDiagram, type PlayDiagram } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { addPlayer } from './diagram-ops';
import { createEditorStore, HISTORY_LIMIT } from './editor-store';

const withNotes = (notes: string) => (diagram: PlayDiagram) => ({ ...diagram, notes });

describe('editor store', () => {
  it('deshace y rehace los cambios en orden', () => {
    const store = createEditorStore(createEmptyDiagram());
    store.getState().apply(withNotes('a'));
    store.getState().apply(withNotes('b'));

    store.getState().undo();
    expect(store.getState().diagram.notes).toBe('a');
    store.getState().undo();
    expect(store.getState().diagram.notes).toBe('');
    store.getState().undo();
    expect(store.getState().diagram.notes).toBe('');

    store.getState().redo();
    store.getState().redo();
    expect(store.getState().diagram.notes).toBe('b');
  });

  it('un cambio nuevo borra lo que se podía rehacer', () => {
    const store = createEditorStore(createEmptyDiagram());
    store.getState().apply(withNotes('a'));
    store.getState().undo();
    store.getState().apply(withNotes('c'));
    expect(store.getState().future).toEqual([]);
  });

  it(`guarda como mucho ${HISTORY_LIMIT} pasos`, () => {
    const store = createEditorStore(createEmptyDiagram());
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) store.getState().apply(withNotes(String(i)));
    expect(store.getState().past).toHaveLength(HISTORY_LIMIT);
  });

  it('deselecciona al jugador que desaparece', () => {
    const added = addPlayer(createEmptyDiagram(), {
      side: 'O',
      position: 'QB',
      label: 'QB',
      at: { x: 0, y: -5 },
    });
    if (!added) throw new Error('debería caber');
    const store = createEditorStore(added.diagram);
    store.getState().select(added.playerId);

    store.getState().apply((diagram) => ({ ...diagram, players: [] }));

    expect(store.getState().selectedId).toBeNull();
  });

  it('sigue con cambios pendientes si se editó durante el guardado', () => {
    const store = createEditorStore(createEmptyDiagram());
    store.getState().apply(withNotes('a'));
    const sent = store.getState().diagram;
    store.getState().apply(withNotes('b'));

    store.getState().markSaved(sent);
    expect(store.getState().dirty).toBe(true);
    store.getState().markSaved(store.getState().diagram);
    expect(store.getState().dirty).toBe(false);
  });
});
