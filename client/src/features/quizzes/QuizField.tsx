import type { PlayDiagram, Ruleset } from '@playbook/shared';
import { useState } from 'react';
import { EditorContext } from '../editor/editor-context';
import { createEditorStore } from '../editor/editor-store';
import { FieldCanvas } from '../editor/FieldCanvas';
import { FIELD_WIDTH, type FieldWindow } from '../field/geometry';

/**
 * La jugada quieta, con el jugador del quiz resaltado (modo jugador) para que su tarea
 * destaque. Se monta con una `key` por diagram para empezar de cero.
 */
export function QuizField({
  diagram,
  ruleset,
  playerId,
  window,
}: {
  diagram: PlayDiagram;
  ruleset: Ruleset;
  playerId: string;
  window: FieldWindow;
}) {
  const [store] = useState(() => {
    const created = createEditorStore(diagram);
    created.getState().setFocus(playerId);
    return created;
  });
  return (
    <EditorContext value={store}>
      <div style={{ aspectRatio: `${FIELD_WIDTH} / ${window.maxY - window.minY}` }}>
        <FieldCanvas
          ruleset={ruleset}
          window={window}
          playbackTime={null}
          showTrails={false}
          readOnly
        />
      </div>
    </EditorContext>
  );
}
