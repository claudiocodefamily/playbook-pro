import type { PlayDiagram } from '@playbook/shared';
import { createStore } from 'zustand/vanilla';

/** Pasos que se pueden deshacer. Cada uno es una copia del diagram (unos pocos KB). */
export const HISTORY_LIMIT = 100;

export interface EditorState {
  diagram: PlayDiagram;
  /** Diagrams anteriores, el más reciente al final. */
  past: PlayDiagram[];
  future: PlayDiagram[];
  selectedId: string | null;
  /** true si hay cambios que aún no se guardaron en la API. */
  dirty: boolean;

  /** Aplica un cambio que se puede deshacer. */
  apply: (change: (diagram: PlayDiagram) => PlayDiagram) => void;
  undo: () => void;
  redo: () => void;
  select: (playerId: string | null) => void;
  /** Tras guardar en la API: el diagram en pantalla ya está guardado. */
  markSaved: (saved: PlayDiagram) => void;
}

export type EditorStore = ReturnType<typeof createEditorStore>;

export function createEditorStore(initial: PlayDiagram) {
  return createStore<EditorState>()((set, get) => ({
    diagram: initial,
    past: [],
    future: [],
    selectedId: null,
    dirty: false,

    apply: (change) => {
      const { diagram, past, selectedId } = get();
      const next = change(diagram);
      if (next === diagram) return;
      set({
        diagram: next,
        past: [...past, diagram].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
        // Si el jugador seleccionado desapareció (borrado o cambio de formación), se deselecciona.
        selectedId: next.players.some((player) => player.id === selectedId) ? selectedId : null,
      });
    },

    undo: () => {
      const { diagram, past, future } = get();
      const previous = past.at(-1);
      if (!previous) return;
      set({
        diagram: previous,
        past: past.slice(0, -1),
        future: [diagram, ...future],
        dirty: true,
      });
    },

    redo: () => {
      const { diagram, past, future } = get();
      const [next, ...rest] = future;
      if (!next) return;
      set({ diagram: next, past: [...past, diagram], future: rest, dirty: true });
    },

    select: (playerId) => set({ selectedId: playerId }),

    // Si el coach siguió editando mientras se guardaba, sigue habiendo cambios pendientes.
    markSaved: (saved) => set({ dirty: get().diagram !== saved }),
  }));
}
