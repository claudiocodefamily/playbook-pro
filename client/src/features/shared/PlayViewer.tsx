import type { PlayDiagram, Ruleset } from '@playbook/shared';
import { useState } from 'react';
import { EditorContext } from '../editor/editor-context';
import { createEditorStore } from '../editor/editor-store';
import { FieldCanvas } from '../editor/FieldCanvas';
import { type Focus } from '../editor/focus';
import { FocusBar } from '../editor/FocusBar';
import { NotesAside } from '../editor/NotesPanel';
import { PlaybackBar } from '../editor/PlaybackBar';
import { usePlayback } from '../editor/usePlayback';
import { FIELD_WIDTH, viewWindow } from '../field/geometry';

interface PlayViewerProps {
  diagram: PlayDiagram;
  ruleset: Ruleset;
  /** Conceptos del glosario que enseña la jugada. */
  concepts: readonly { id: string; name: string; explanation: string }[];
  /** Modo jugador con el que se abre (un jugador con cuenta ve resaltada su posición). */
  initialFocus?: Focus;
}

/**
 * Una jugada animada, sin herramientas de edición: para los links compartidos y para los
 * jugadores con cuenta. Se monta con una `key` por jugada para empezar de cero.
 */
export function PlayViewer({ diagram, ruleset, concepts, initialFocus = null }: PlayViewerProps) {
  const [store] = useState(() => {
    const created = createEditorStore(diagram);
    created.getState().setFocus(initialFocus);
    return created;
  });
  const playback = usePlayback(store);
  const [showTrails, setShowTrails] = useState(true);
  const [fieldWindow] = useState(() => viewWindow(diagram));
  const aspect = FIELD_WIDTH / (fieldWindow.maxY - fieldWindow.minY);

  return (
    <EditorContext value={store}>
      <div className="flex flex-col gap-3 rounded-3xl bg-turf-900 p-2 sm:p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:justify-center">
          <div
            className="mx-auto w-full lg:mx-0"
            style={{ maxWidth: `calc((100dvh - 16rem) * ${aspect})` }}
          >
            <FieldCanvas
              ruleset={ruleset}
              window={fieldWindow}
              playbackTime={playback.time}
              showTrails={showTrails}
              readOnly
            />
          </div>
          <NotesAside notes={diagram.notes} concepts={concepts} />
        </div>
        <PlaybackBar
          playback={playback}
          trails={showTrails}
          onToggleTrails={() => setShowTrails((value) => !value)}
        />
        <FocusBar />
      </div>
    </EditorContext>
  );
}
