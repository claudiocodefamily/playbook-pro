import { useQuery } from '@tanstack/react-query';
import { Maximize2, Minimize2, PencilRuler } from 'lucide-react';
import { useRef } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { PageSpinner } from '../../components/ui/spinner';
import { useFullscreen } from '../../hooks/useFullscreen';
import { queries } from '../../lib/api/queries';
import { errorText } from '../../lib/errors';
import { FieldPreview } from '../field/FieldPreview';
import { fitWindow } from '../field/geometry';

/** Vista de una jugada. El editor de la cancha llega en el bloque 4b. */
export function PlayPage() {
  const { teamId = '', playId = '' } = useParams();
  const play = useQuery(queries.play(teamId, playId));
  const team = useQuery(queries.team(teamId));
  const stageRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(stageRef);

  if (play.isPending) return <PageSpinner />;
  if (play.isError) return <ErrorAlert message={errorText(play.error)} />;

  const { diagram } = play.data;
  return (
    <>
      <PageHeader
        title={play.data.name}
        subtitle={play.data.tags.map((tag) => `#${tag}`).join(' ') || undefined}
        back={{ to: `/teams/${teamId}/playbooks/${play.data.playbookId}`, label: 'Jugadas' }}
        actions={
          fullscreen.supported && (
            <Button variant="secondary" onClick={() => void fullscreen.toggle()}>
              <Maximize2 aria-hidden className="size-4" />
              Modo presentación
            </Button>
          )
        }
      />

      <div
        ref={stageRef}
        className="relative flex items-center justify-center rounded-3xl bg-turf-900 p-2 sm:p-4"
      >
        <FieldPreview
          players={diagram.players}
          assignments={diagram.assignments}
          ruleset={team.data?.ruleset}
          window={fitWindow([...diagram.players, ...diagram.assignments.flatMap((a) => a.points)])}
          animate
          title={play.data.name}
          className={
            fullscreen.active
              ? 'max-h-[calc(100dvh-2rem)] w-auto max-w-full'
              : 'max-h-[calc(100dvh-16rem)] w-auto max-w-full'
          }
        />
        {fullscreen.active && (
          <Button
            variant="secondary"
            className="absolute top-4 right-4"
            onClick={() => void fullscreen.toggle()}
          >
            <Minimize2 aria-hidden className="size-4" />
            Salir
          </Button>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
        <PencilRuler aria-hidden className="mt-0.5 size-5 shrink-0 text-turf-700" />
        <p>
          Aquí llegará el editor: mover jugadores con el dedo, dibujar rutas y bloqueos, deshacer y
          autoguardado.
          {diagram.notes && <span className="mt-2 block text-slate-800">{diagram.notes}</span>}
        </p>
      </div>
    </>
  );
}
