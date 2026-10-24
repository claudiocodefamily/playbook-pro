import type { PlayDiagram, Ruleset } from '@playbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { FileDown, Printer } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { playsApi } from '../../lib/api/endpoints';
import { queries } from '../../lib/api/queries';
import type { GamePlan } from '../../lib/api/types';
import { errorText } from '../../lib/errors';
import { buildCallSheetPdf } from '../export/call-sheet';
import { downloadBlob, safeFilename } from '../export/download';
import { PlayImageQueue, type RenderedPlay } from '../export/PlayImage';
import { formatGameDate } from './situations';

/** Cuántas jugadas se piden a la vez para las miniaturas. */
const PARALLEL = 4;

interface Job {
  teamName: string;
  ruleset: Ruleset;
  /** Las jugadas a dibujar, en el orden de `playIds`. */
  playIds: string[];
  diagrams: PlayDiagram[];
}

/** "Call sheet": el game plan en una hoja A4 horizontal para llevar en la banda. */
export function CallSheetButton({ teamId, plan }: { teamId: string; plan: GamePlan | undefined }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [thumbnails, setThumbnails] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const busy = preparing || job !== null;

  const build = useCallback(
    async (teamName: string, images: ReadonlyMap<string, RenderedPlay>) => {
      if (!plan) return;
      const names = new Map(plan.plays.map((play) => [play.id, play.name]));
      const blob = await buildCallSheetPdf({
        teamName,
        opponent: plan.opponent,
        dateText: formatGameDate(plan.gameDate) ?? '',
        // Las situaciones vacías no ocupan sitio en la hoja.
        situations: plan.situations
          .filter((situation) => situation.playIds.length > 0)
          .map((situation) => ({
            name: situation.name,
            plays: situation.playIds.map((playId) => ({
              name: names.get(playId) ?? '',
              image: images.get(playId),
            })),
          })),
      });
      downloadBlob(blob, `${safeFilename(`call-sheet-${plan.opponent}`)}.pdf`);
    },
    [plan],
  );

  const start = async () => {
    if (!plan) return;
    setError(null);
    setPreparing(true);
    try {
      const team = await client.fetchQuery(queries.team(teamId));
      const playIds = [...new Set(plan.situations.flatMap((situation) => situation.playIds))];
      if (!thumbnails) {
        await build(team.name, new Map());
        return;
      }
      const diagrams: PlayDiagram[] = [];
      for (let index = 0; index < playIds.length; index += PARALLEL) {
        const batch = await Promise.all(
          playIds.slice(index, index + PARALLEL).map((playId) => playsApi.get(teamId, playId)),
        );
        diagrams.push(...batch.map((play) => play.diagram));
      }
      setProgress(0);
      setJob({ teamName: team.name, ruleset: team.ruleset, playIds, diagrams });
    } catch (caught) {
      setError(caught);
    } finally {
      setPreparing(false);
    }
  };

  const finish = useCallback(
    async (images: RenderedPlay[]) => {
      if (!job) return;
      try {
        const byPlay = new Map<string, RenderedPlay>();
        job.playIds.forEach((playId, index) => {
          const image = images[index];
          if (image) byPlay.set(playId, image);
        });
        await build(job.teamName, byPlay);
      } catch (caught) {
        setError(caught);
      } finally {
        setJob(null);
      }
    },
    [job, build],
  );

  return (
    <>
      <Button
        variant="secondary"
        disabled={!plan || plan.playCount === 0}
        title={plan?.playCount === 0 ? 'Añade jugadas primero' : 'Hoja para la banda, en PDF'}
        onClick={() => setOpen(true)}
      >
        <Printer aria-hidden className="size-4" />
        Call sheet
      </Button>
      <Modal open={open} title="Call sheet" onClose={() => !busy && setOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Una hoja A4 horizontal con una columna por situación y sus jugadas numeradas, para
            imprimirla y llevarla en la banda. Las situaciones sin jugadas no salen.
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 accent-turf-700"
              checked={thumbnails}
              disabled={busy}
              onChange={(event) => setThumbnails(event.target.checked)}
            />
            Con el dibujo de cada jugada (ocupa más hojas)
          </label>
          <ErrorAlert message={errorText(error)} />
          {job && (
            <p role="status" className="text-sm font-medium text-slate-600">
              Dibujando jugada {Math.min(progress + 1, job.diagrams.length)} de{' '}
              {job.diagrams.length}…
            </p>
          )}
          <Button loading={busy} className="self-start" onClick={() => void start()}>
            <FileDown aria-hidden className="size-4" />
            Descargar PDF
          </Button>
        </div>
        {job && (
          <PlayImageQueue
            diagrams={job.diagrams}
            ruleset={job.ruleset}
            showDrawings
            onProgress={setProgress}
            onDone={(images) => void finish(images)}
          />
        )}
      </Modal>
    </>
  );
}
