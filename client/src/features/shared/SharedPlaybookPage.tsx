import type { Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { PageSpinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import type { SharedPlaybook } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { SIDE_LABELS } from '../../lib/labels';
import { EditorContext } from '../editor/editor-context';
import { createEditorStore } from '../editor/editor-store';
import { FieldCanvas } from '../editor/FieldCanvas';
import { FocusBar } from '../editor/FocusBar';
import { NotesAside } from '../editor/NotesPanel';
import { PlaybackBar } from '../editor/PlaybackBar';
import { usePlayback } from '../editor/usePlayback';
import { diagramReach, diagramWindow, FIELD_WIDTH } from '../field/geometry';
import { SIDE_STYLE } from '../playbooks/side-style';

type SharedPlay = SharedPlaybook['plays'][number];

/**
 * Lo que ve quien abre un link compartido, sin cuenta: las jugadas del playbook animadas,
 * con el modo jugador, las notas y los conceptos. No se puede cambiar nada.
 */
export function SharedPlaybookPage() {
  const { token = '' } = useParams();
  const shared = useQuery(queries.shared(token));
  const [playId, setPlayId] = useState<string | null>(null);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-turf-800 text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <span className="flex min-w-0 items-center gap-2 text-lg font-bold">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15"
            >
              🏈
            </span>
            <span className="truncate">{shared.data?.teamName ?? 'PlayBook Pro'}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold sm:inline-flex">
              <Eye aria-hidden className="size-3.5" />
              Solo lectura
            </span>
            <ThemeToggle className="text-white hover:bg-white/15" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        {shared.isPending ? (
          <PageSpinner label="Abriendo el playbook…" />
        ) : shared.isError ? (
          <EmptyState
            icon={LinkIcon}
            title="No se puede abrir este link"
            description={errorText(shared.error) ?? 'Pide al coach un link nuevo.'}
          />
        ) : (
          <SharedPlaybookView
            playbook={shared.data}
            playId={playId ?? shared.data.plays[0]?.id ?? null}
            onSelect={setPlayId}
          />
        )}
      </main>
    </div>
  );
}

function SharedPlaybookView({
  playbook,
  playId,
  onSelect,
}: {
  playbook: SharedPlaybook;
  playId: string | null;
  onSelect: (playId: string) => void;
}) {
  const index = playbook.plays.findIndex((play) => play.id === playId);
  const play = playbook.plays[index];
  const go = (delta: number) => {
    const next = playbook.plays[index + delta];
    if (next) onSelect(next.id);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{playbook.name}</h1>
          <span
            className={cn('rounded-full px-3 py-1 text-xs font-bold', SIDE_STYLE[playbook.side])}
          >
            {SIDE_LABELS[playbook.side]}
          </span>
        </div>
        {playbook.description && <p className="text-slate-600">{playbook.description}</p>}
      </div>

      {playbook.plays.length === 0 || !play ? (
        <EmptyState
          icon={Eye}
          title="Este playbook todavía no tiene jugadas"
          description="Cuando el coach añada jugadas aparecerán aquí con este mismo link."
        />
      ) : (
        <>
          <nav aria-label="Jugadas" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2 pb-1">
              {playbook.plays.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    aria-current={candidate.id === play.id ? 'true' : undefined}
                    onClick={() => onSelect(candidate.id)}
                    className={cn(
                      'min-h-11 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                      candidate.id === play.id
                        ? 'bg-turf-700 text-white'
                        : 'bg-surface text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {candidate.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{play.name}</h2>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Jugada anterior"
                disabled={index === 0}
                onClick={() => go(-1)}
              >
                <ChevronLeft aria-hidden className="size-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Jugada siguiente"
                disabled={index === playbook.plays.length - 1}
                onClick={() => go(1)}
              >
                <ChevronRight aria-hidden className="size-5" />
              </Button>
            </div>
          </div>

          {/* key: cada jugada tiene su propia reproducción y su modo jugador. */}
          <SharedPlayViewer
            key={play.id}
            play={play}
            ruleset={playbook.ruleset}
            concepts={playbook.concepts}
          />
        </>
      )}
    </div>
  );
}

/** Una jugada animada, sin herramientas de edición. */
function SharedPlayViewer({
  play,
  ruleset,
  concepts,
}: {
  play: SharedPlay;
  ruleset: Ruleset;
  concepts: SharedPlaybook['concepts'];
}) {
  const [store] = useState(() => createEditorStore(play.diagram));
  const playback = usePlayback(store);
  const [showTrails, setShowTrails] = useState(true);
  const [fieldWindow] = useState(() => {
    const base = diagramWindow(play.diagram);
    return { ...base, maxY: Math.max(base.maxY, diagramReach(play.diagram)) };
  });
  const aspect = FIELD_WIDTH / (fieldWindow.maxY - fieldWindow.minY);
  const linked = play.conceptIds.flatMap((id) => {
    const concept = concepts.find((candidate) => candidate.id === id);
    return concept ? [concept] : [];
  });

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
          <NotesAside notes={play.diagram.notes} concepts={linked} />
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
