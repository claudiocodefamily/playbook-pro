import type { PlayDiagram, Ruleset } from '@playbook/shared';
import { FileDown, ImageDown } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { errorText } from '../../lib/errors';
import { dataUrlToBlob, downloadBlob, safeFilename } from './download';
import { buildPlaybookPdf } from './pdf';
import { PlayImageQueue, type RenderedPlay } from './PlayImage';

export interface ExportPlay {
  name: string;
  tags: readonly string[];
  diagram: PlayDiagram;
  concepts: readonly { name: string; explanation: string }[];
}

/** Lo que se exporta: se carga al pulsar el botón (un playbook pide todas sus jugadas). */
export interface ExportSource {
  teamName: string;
  ruleset: Ruleset;
  title: string;
  subtitle: string;
  plays: ExportPlay[];
}

type Format = 'png' | 'pdf';

type Job = { format: Format; source: ExportSource; showDrawings: boolean };

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** PNG solo tiene sentido para una jugada. */
  formats: readonly Format[];
  prepare: () => Promise<ExportSource>;
}

/**
 * Exportar a imagen o PDF, con la opción de quitar los dibujos del lápiz. Todo se genera
 * en el navegador con la misma cancha que se ve en pantalla, en la posición antes del snap.
 */
export function ExportDialog({ open, onClose, title, formats, prepare }: ExportDialogProps) {
  const [showDrawings, setShowDrawings] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [preparing, setPreparing] = useState<Format | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const busy = preparing !== null || job !== null;

  const start = async (format: Format) => {
    setError(null);
    setPreparing(format);
    try {
      const source = await prepare();
      setProgress(0);
      setJob({ format, source, showDrawings });
    } catch (caught) {
      setError(caught);
    } finally {
      setPreparing(null);
    }
  };

  const finish = useCallback(
    async (images: RenderedPlay[]) => {
      if (!job) return;
      try {
        const { source, format } = job;
        const first = images[0];
        if (format === 'png' && first) {
          downloadBlob(await dataUrlToBlob(first.dataUrl), `${safeFilename(source.title)}.png`);
        } else {
          const blob = await buildPlaybookPdf({
            teamName: source.teamName,
            title: source.title,
            subtitle: source.subtitle,
            plays: source.plays.map((play, index) => ({
              name: play.name,
              tags: play.tags,
              notes: play.diagram.notes,
              concepts: play.concepts,
              image: images[index] ?? { dataUrl: '', aspect: 1 },
            })),
          });
          downloadBlob(blob, `${safeFilename(source.title)}.pdf`);
        }
      } catch (caught) {
        setError(caught);
      } finally {
        setJob(null);
      }
    },
    [job],
  );

  const total = job?.source.plays.length ?? 0;

  return (
    <Modal open={open} title={title} onClose={() => !busy && onClose()}>
      <div className="flex flex-col gap-4">
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-turf-700"
            checked={showDrawings}
            disabled={busy}
            onChange={(event) => setShowDrawings(event.target.checked)}
          />
          Incluir los dibujos del lápiz
        </label>
        <p className="text-sm text-slate-600">
          La cancha sale con los jugadores en su posición antes del snap y todas las rutas, bloqueos
          y coberturas. Las notas y los conceptos van debajo en el PDF.
        </p>
        <ErrorAlert message={errorText(error)} />
        {job && total > 1 && (
          <p role="status" className="text-sm font-medium text-slate-600">
            Dibujando jugada {Math.min(progress + 1, total)} de {total}…
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {formats.includes('pdf') && (
            <Button
              loading={preparing === 'pdf' || job?.format === 'pdf'}
              disabled={busy}
              onClick={() => void start('pdf')}
            >
              <FileDown aria-hidden className="size-4" />
              Descargar PDF
            </Button>
          )}
          {formats.includes('png') && (
            <Button
              variant="secondary"
              loading={preparing === 'png' || job?.format === 'png'}
              disabled={busy}
              onClick={() => void start('png')}
            >
              <ImageDown aria-hidden className="size-4" />
              Descargar imagen (PNG)
            </Button>
          )}
        </div>
      </div>
      {job && (
        <PlayImageQueue
          diagrams={job.source.plays.map((play) => play.diagram)}
          ruleset={job.source.ruleset}
          showDrawings={job.showDrawings}
          onProgress={setProgress}
          onDone={(images) => void finish(images)}
        />
      )}
    </Modal>
  );
}
