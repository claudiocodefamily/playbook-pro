import { type PlayDiagram, type PlaybookSide, type Ruleset } from '@playbook/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookmarkPlus,
  Check,
  History,
  Maximize2,
  Minimize2,
  Redo2,
  Shield,
  Undo2,
  UserPlus,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { useFullscreen } from '../../hooks/useFullscreen';
import { queries } from '../../lib/api/queries';
import type { Play } from '../../lib/api/types';
import { errorText } from '../../lib/errors';
import { SIDE_LABELS } from '../../lib/labels';
import { FIELD_WIDTH, type FieldWindow, fitWindow } from '../field/geometry';
import { FormationPicker } from '../plays/FormationPicker';
import {
  addPlayer,
  applyFormation,
  countSide,
  MAX_PER_SIDE,
  removeAssignment,
  removePlayer,
} from './diagram-ops';
import { EditorContext, useEditor } from './editor-context';
import { createEditorStore, type EditorStore } from './editor-store';
import { FieldCanvas } from './FieldCanvas';
import { PlaybackBar } from './PlaybackBar';
import { PlayerPanel } from './PlayerPanel';
import { SaveIndicator } from './SaveIndicator';
import { ToolBar } from './ToolBar';
import { useAutosave } from './useAutosave';
import { type Playback, usePlayback } from './usePlayback';
import { VersionsDialog } from './VersionsDialog';

/** Unidad contraria, para colocar al rival enfrente: ataque contra defensa. */
const RIVAL_SIDE: Readonly<Record<PlaybookSide, PlaybookSide>> = {
  offense: 'defense',
  defense: 'offense',
  special: 'special',
};

export function EditorPage() {
  const { teamId = '', playId = '' } = useParams();
  // Mientras se edita no se vuelve a pedir la jugada (pisaría lo que está en pantalla);
  // al salir se descarta de la caché (gcTime 0), así la próxima vez se abre la versión guardada.
  const play = useQuery({
    ...queries.play(teamId, playId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const team = useQuery(queries.team(teamId));
  const playbook = useQuery({
    ...queries.playbook(teamId, play.data?.playbookId ?? ''),
    enabled: Boolean(play.data),
  });

  if (play.isPending || (play.data && playbook.isPending)) return <PageSpinner />;
  if (play.isError) return <ErrorAlert message={errorText(play.error)} />;
  if (playbook.isError) return <ErrorAlert message={errorText(playbook.error)} />;
  if (!playbook.data) return <PageSpinner />;

  return (
    // key: si cambia la jugada se crea un editor nuevo, con su propio historial.
    <Editor
      key={play.data.id}
      play={play.data}
      side={playbook.data.side}
      ruleset={team.data?.ruleset ?? 'college'}
    />
  );
}

function Editor({ play, side, ruleset }: { play: Play; side: PlaybookSide; ruleset: Ruleset }) {
  const [store] = useState(() => createEditorStore(play.diagram));
  const autosave = useAutosave(store, play);
  const playback = usePlayback(store);
  const [showVersions, setShowVersions] = useState(false);
  const queryClient = useQueryClient();
  const stageRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(stageRef);
  // La ventana del campo se fija al abrir: si cambiara al arrastrar, la cancha "bailaría".
  const [fieldWindow] = useState<FieldWindow>(() => {
    const fit = fitWindow([
      ...play.diagram.players,
      ...play.diagram.assignments.flatMap((a) => a.points),
    ]);
    return { minY: Math.min(-12, fit.minY), maxY: Math.max(18, fit.maxY) };
  });
  // Ancho máximo para que la cancha completa quepa a lo alto de la pantalla.
  const aspect = FIELD_WIDTH / (fieldWindow.maxY - fieldWindow.minY);

  useKeyboardShortcuts(store, playback);

  return (
    <EditorContext value={store}>
      <PageHeader
        title={play.name}
        subtitle={<SaveIndicator status={autosave.status} />}
        back={{ to: `/teams/${play.teamId}/playbooks/${play.playbookId}`, label: 'Jugadas' }}
        actions={
          <>
            <HistoryButtons />
            <SaveVersionButton
              onSave={autosave.saveVersion}
              disabled={autosave.status === 'conflict'}
            />
            <Button variant="secondary" onClick={() => setShowVersions(true)} title="Historial">
              <History aria-hidden className="size-4" />
              <span className="hidden sm:inline">Historial</span>
            </Button>
          </>
        }
      />
      <VersionsDialog
        open={showVersions}
        onClose={() => setShowVersions(false)}
        teamId={play.teamId}
        playId={play.id}
        ruleset={ruleset}
        onRestore={(diagram: PlayDiagram) => store.getState().apply(() => diagram)}
      />

      {autosave.status === 'conflict' && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200 sm:flex-row sm:items-center sm:justify-between">
          <p>{autosave.error} Tus últimos cambios no se guardaron para no pisar los suyos.</p>
          <Button
            variant="danger"
            onClick={() =>
              void queryClient.resetQueries({
                queryKey: queries.play(play.teamId, play.id).queryKey,
              })
            }
          >
            Recargar la jugada
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div
          ref={stageRef}
          className="mx-auto flex w-full flex-col gap-2 rounded-3xl bg-turf-900 p-2 sm:p-3 lg:flex-1"
          style={{
            // Lo que queda de alto tras la barra de herramientas y la de reproducción.
            maxWidth: fullscreen.active
              ? `calc((100dvh - 10rem) * ${aspect})`
              : `calc((100dvh - 20rem) * ${aspect})`,
          }}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ToolBar />
            </div>
            {fullscreen.supported && (
              <Button
                variant="secondary"
                size="icon"
                className="mt-1 shrink-0"
                aria-label={fullscreen.active ? 'Salir del modo presentación' : 'Modo presentación'}
                title={fullscreen.active ? 'Salir del modo presentación' : 'Modo presentación'}
                onClick={() => void fullscreen.toggle()}
              >
                {fullscreen.active ? (
                  <Minimize2 aria-hidden className="size-5" />
                ) : (
                  <Maximize2 aria-hidden className="size-5" />
                )}
              </Button>
            )}
          </div>
          <FieldCanvas ruleset={ruleset} window={fieldWindow} playbackTime={playback.time} />
          <PlaybackBar playback={playback} />
        </div>

        <aside className="flex flex-col gap-4 lg:w-72">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <PlayerPanel />
          </section>
          <SidePanel teamId={play.teamId} side={side} ruleset={ruleset} />
        </aside>
      </div>
    </EditorContext>
  );
}

function HistoryButtons() {
  const canUndo = useEditor((state) => state.past.length > 0);
  const canRedo = useEditor((state) => state.future.length > 0);
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  return (
    <>
      <Button variant="secondary" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
        <Undo2 aria-hidden className="size-4" />
        <span className="hidden sm:inline">Deshacer</span>
      </Button>
      <Button variant="secondary" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">
        <Redo2 aria-hidden className="size-4" />
        <span className="hidden sm:inline">Rehacer</span>
      </Button>
    </>
  );
}

/** Deja una copia de la jugada en el historial, con una confirmación animada. */
function SaveVersionButton({
  onSave,
  disabled,
}: {
  onSave: () => Promise<boolean>;
  disabled: boolean;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  useEffect(() => {
    if (state !== 'done') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <Button
      variant={state === 'done' ? 'primary' : 'secondary'}
      loading={state === 'saving'}
      disabled={disabled}
      title="Guarda una copia en el historial para poder volver a ella"
      onClick={async () => {
        setState('saving');
        setState((await onSave()) ? 'done' : 'idle');
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state === 'done' ? 'done' : 'idle'}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-2"
        >
          {state === 'done' ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <BookmarkPlus aria-hidden className="size-4" />
          )}
          {state === 'done' ? 'Versión guardada' : 'Guardar versión'}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

/** Formación propia, rival y añadir jugadores. */
function SidePanel({
  teamId,
  side,
  ruleset,
}: {
  teamId: string;
  side: PlaybookSide;
  ruleset: Ruleset;
}) {
  const apply = useEditor((state) => state.apply);
  const select = useEditor((state) => state.select);
  const ownSide = side === 'defense' ? 'D' : 'O';
  const ownCount = useEditor((state) => countSide(state.diagram, ownSide));
  const [picking, setPicking] = useState<'own' | 'rival' | null>(null);
  const pickingSide = picking === 'rival' ? RIVAL_SIDE[side] : side;
  const diagramSide = picking === 'rival' ? (ownSide === 'O' ? 'D' : 'O') : ownSide;

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <h2 className="mb-1 font-semibold">Cancha</h2>
      <Button variant="secondary" className="justify-start" onClick={() => setPicking('own')}>
        <Users aria-hidden className="size-4" />
        Formación ({SIDE_LABELS[side].toLowerCase()})
      </Button>
      <Button variant="secondary" className="justify-start" onClick={() => setPicking('rival')}>
        <Shield aria-hidden className="size-4" />
        Poner rival ({SIDE_LABELS[RIVAL_SIDE[side]].toLowerCase()})
      </Button>
      <Button
        variant="secondary"
        className="justify-start"
        disabled={ownCount >= MAX_PER_SIDE}
        title={ownCount >= MAX_PER_SIDE ? 'Ya hay 11 jugadores' : undefined}
        onClick={() => {
          let addedId: string | null = null;
          apply((diagram) => {
            const added = addPlayer(diagram, {
              side: ownSide,
              position: side === 'defense' ? 'LB' : 'WR',
              label: 'J',
              at: { x: 0, y: ownSide === 'O' ? -3 : 3 },
            });
            if (!added) return diagram;
            addedId = added.playerId;
            return added.diagram;
          });
          if (addedId) select(addedId);
        }}
      >
        <UserPlus aria-hidden className="size-4" />
        Añadir jugador ({ownCount}/{MAX_PER_SIDE})
      </Button>

      <Modal
        open={picking !== null}
        title={picking === 'rival' ? 'Poner rival' : 'Cambiar formación'}
        onClose={() => setPicking(null)}
      >
        <p className="mb-4 text-sm text-slate-600">
          {picking === 'rival'
            ? 'Coloca al rival enfrente para explicar contra qué se corre la jugada.'
            : 'Los jugadores se mueven a la nueva formación y conservan sus rutas.'}
        </p>
        <FormationPicker
          teamId={teamId}
          side={pickingSide}
          ruleset={ruleset}
          value={null}
          emptyLabel={picking === 'rival' ? 'Sin rival' : 'Quitar a todos'}
          onChange={(_id, formation) => {
            apply((diagram) =>
              formation
                ? applyFormation(diagram, formation.players, diagramSide)
                : diagram.players
                    .filter((player) => player.side === diagramSide)
                    .reduce((current, player) => removePlayer(current, player.id), diagram),
            );
            setPicking(null);
          }}
        />
      </Modal>
    </section>
  );
}

/**
 * Ctrl/Cmd+Z deshace, Ctrl/Cmd+Shift+Z o Ctrl+Y rehace, Supr borra lo seleccionado,
 * Espacio reproduce o pausa la jugada y Escape deselecciona.
 */
function useKeyboardShortcuts(store: EditorStore, playback: Playback) {
  // La reproducción cambia en cada fotograma: se lee de un ref para no recolgar el listener.
  const playbackRef = useRef(playback);
  useEffect(() => {
    playbackRef.current = playback;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const state = store.getState();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const { selectedAssignmentId, selectedId } = state;
        if (selectedAssignmentId) {
          state.apply((diagram) => removeAssignment(diagram, selectedAssignmentId));
        } else if (selectedId) {
          state.apply((diagram) => removePlayer(diagram, selectedId));
        }
      } else if (event.key === ' ' && target?.tagName !== 'BUTTON') {
        const current = playbackRef.current;
        if (!current.canPlay) return;
        event.preventDefault();
        if (current.playing) current.pause();
        else current.play();
      } else if (event.key === 'Escape') {
        state.select(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);
}
