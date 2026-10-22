import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { EditorState, EditorStore } from './editor-store';

export const EditorContext = createContext<EditorStore | null>(null);

/** Lee una parte del estado del editor; el componente solo se repinta si esa parte cambia. */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  const store = useContext(EditorContext);
  if (!store) throw new Error('useEditor se usó fuera de <EditorContext>');
  return useStore(store, selector);
}
