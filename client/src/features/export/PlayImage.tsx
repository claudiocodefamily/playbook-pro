import type { PlayDiagram, Ruleset } from '@playbook/shared';
import type Konva from 'konva';
import { useEffect, useRef, useState } from 'react';
import { EditorContext } from '../editor/editor-context';
import { createEditorStore } from '../editor/editor-store';
import { FieldCanvas } from '../editor/FieldCanvas';
import { FIELD_WIDTH, viewWindow } from '../field/geometry';

/** Ancho en píxeles al que se dibuja la cancha para exportar (x2 de densidad = 2400 px). */
const EXPORT_WIDTH = 1200;

export interface RenderedPlay {
  /** PNG en data URL. */
  dataUrl: string;
  /** Ancho / alto de la imagen. */
  aspect: number;
}

/**
 * Dibuja la jugada fuera de la pantalla, en la posición inicial (antes del snap), y
 * devuelve su imagen. Usa la misma cancha que el editor, así la exportación se ve igual.
 */
export function PlayImage({
  diagram,
  ruleset,
  showDrawings,
  onRendered,
}: {
  diagram: PlayDiagram;
  ruleset: Ruleset;
  showDrawings: boolean;
  onRendered: (rendered: RenderedPlay) => void;
}) {
  const [store] = useState(() => createEditorStore(diagram));
  const [window] = useState(() => viewWindow(diagram));
  const stageRef = useRef<Konva.Stage>(null);
  // El callback cambia en cada render del padre; se lee de un ref para no repetir la foto.
  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  useEffect(() => {
    let frame = 0;
    let waited = 0;
    // react-konva pinta en el siguiente fotograma: se espera a que exista el Stage y a
    // un par de fotogramas más para que todo esté dibujado.
    const tick = () => {
      const stage = stageRef.current;
      if (stage && stage.width() > 0 && ++waited > 2) {
        onRenderedRef.current({
          dataUrl: stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' }),
          aspect: stage.width() / stage.height(),
        });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <EditorContext value={store}>
      <div
        style={{
          width: EXPORT_WIDTH,
          aspectRatio: `${FIELD_WIDTH} / ${window.maxY - window.minY}`,
        }}
      >
        <FieldCanvas
          ruleset={ruleset}
          window={window}
          playbackTime={null}
          showTrails={false}
          showDrawings={showDrawings}
          readOnly
          stageRef={stageRef}
        />
      </div>
    </EditorContext>
  );
}

/**
 * Dibuja varias jugadas una detrás de otra (para no tener muchas canchas a la vez en
 * memoria) en un rincón invisible de la página.
 */
export function PlayImageQueue({
  diagrams,
  ruleset,
  showDrawings,
  onProgress,
  onDone,
}: {
  diagrams: readonly PlayDiagram[];
  ruleset: Ruleset;
  showDrawings: boolean;
  onProgress?: (done: number) => void;
  onDone: (rendered: RenderedPlay[]) => void;
}) {
  const [done, setDone] = useState<RenderedPlay[]>([]);
  const current = diagrams[done.length];
  // Los callbacks se leen de un ref: así cada avance se avisa una sola vez aunque el padre
  // vuelva a pintarse con funciones nuevas.
  const callbacks = useRef({ onProgress, onDone });
  useEffect(() => {
    callbacks.current = { onProgress, onDone };
  });

  useEffect(() => {
    callbacks.current.onProgress?.(done.length);
    if (done.length === diagrams.length) callbacks.current.onDone(done);
  }, [done, diagrams.length]);

  return (
    <div aria-hidden style={{ position: 'fixed', left: -100_000, top: 0, pointerEvents: 'none' }}>
      {current && (
        <PlayImage
          key={done.length}
          diagram={current}
          ruleset={ruleset}
          showDrawings={showDrawings}
          onRendered={(rendered) => setDone((previous) => [...previous, rendered])}
        />
      )}
    </div>
  );
}
