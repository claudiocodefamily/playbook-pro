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
import { useStore } from 'zustand';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { usePresentation } from '../../hooks/usePresentation';
import { queries } from '../../lib/api/queries';
import type { Play } from '../../lib/api/types';
import { errorText } from '../../lib/errors';
import { SIDE_LABELS } from '../../lib/labels';
import { cn } from '../../lib/cn';
import { diagramReach, diagramWindow, FIELD_WIDTH, type FieldWindow } from '../field/geometry';
import { momentAt } from '../field/moments';
import { ExportPlayButton } from '../export/ExportButtons';
import { FormationPicker } from '../plays/FormationPicker';
import {
  addPlayer,
  applyFormation,
  countSide,
  MAX_PER_SIDE,
  removeAssignment,
  removePlayer,
  setYardLine,
} from './diagram-ops';
import { EditorContext, useEditor } from './editor-context';
import { createEditorStore, type EditorStore } from './editor-store';
import { FieldCanvas } from './FieldCanvas';
import { PlaybackBar } from './PlaybackBar';
import { FocusBar } from './FocusBar';
import { NotesPanel, PresentationNotes } from './NotesPanel';
import { PlayerPanel } from './PlayerPanel';
import { PlayerPlayView } from './PlayerPlayView';
import { SaveIndicator } from './SaveIndicator';
import { TimelinePanel } from './TimelinePanel';
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

  if (play.isPending || team.isPending || (play.data && playbook.isPending)) {
    return <PageSpinner />;
  }
  if (play.isError) return <ErrorAlert message={errorText(play.error)} />;
  if (playbook.isError) return <ErrorAlert message={errorText(playbook.error)} />;
  if (!playbook.data) return <PageSpinner />;
  // Un jugador solo mira: la jugada animada, sin herramientas.
  if (team.data?.myRole === 'PLAYER') {
    return <PlayerPlayView play={play.data} ruleset={team.data.ruleset} />;
  }

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
  const presentation = usePresentation(stageRef);
  // La estela muestra por dónde pasó cada jugador durante la animación.
  const [showTrails, setShowTrails] = useState(true);
  // La ventana del campo se fija al abrir: si cambiara al arrastrar, la cancha "bailaría".
  const [baseWindow] = useState<FieldWindow>(() => diagramWindow(play.diagram));
  // Solo crece si algo queda fuera: un rival puesto campo abajo (un punt return) o una
  // patada a portería. Arrastrar no la cambia: los jugadores no salen de la cancha.
  const reach = useStore(store, (state) => diagramReach(state.diagram));
  const fieldWindow = reach > baseWindow.maxY ? { ...baseWindow, maxY: reach } : baseWindow;
  // Ancho máximo para que la cancha completa quepa a lo alto de la pantalla.
  const aspect = FIELD_WIDTH / (fieldWindow.maxY - fieldWindow.minY);

  useKeyboardShortcuts(store, playback);

  // Escape sale del modo presentación cuando el navegador no está a pantalla completa
  // (si lo está, Escape ya la cierra y el hook se entera).
  const { active: presenting, exit: exitPresentation } = presentation;
  useEffect(() => {
    if (!presenting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) void exitPresentation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presenting, exitPresentation]);

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
            <ExportPlayButton
              teamId={play.teamId}
              name={play.name}
              tags={play.tags}
              conceptIds={play.conceptIds}
              side={side}
              getDiagram={() => store.getState().diagram}
            />
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
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex min-w-0 flex-col gap-4 lg:flex-1">
          <div
            ref={stageRef}
            className={cn(
              'flex flex-col gap-2 bg-turf-900',
              presenting
                ? 'fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4'
                : 'mx-auto w-full rounded-3xl p-2 sm:p-3',
            )}
            style={{
              // Lo que queda de alto tras la barra de herramientas y la de reproducción.
              maxWidth: presenting ? undefined : `calc((100dvh - 23rem) * ${aspect})`,
            }}
          >
            {presenting ? (
              <PresentationHeader
                title={play.name}
                playback={playback}
                onExit={() => void presentation.exit()}
              />
            ) : (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ToolBar />
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="mt-1 shrink-0"
                  aria-label="Modo presentación"
                  title="Modo presentación: pantalla completa para explicar la jugada"
                  onClick={() => void presentation.enter()}
                >
                  <Maximize2 aria-hidden className="size-5" />
                </Button>
              </div>
            )}
            <div className={cn(presenting && 'flex flex-col gap-3 lg:flex-row lg:justify-center')}>
              <div
                className={cn('mx-auto w-full', presenting && 'lg:mx-0')}
                style={presenting ? { maxWidth: `calc((100dvh - 13rem) * ${aspect})` } : undefined}
              >
                <FieldCanvas
                  ruleset={ruleset}
                  window={fieldWindow}
                  playbackTime={playback.time}
                  showTrails={showTrails}
                />
              </div>
              {presenting && <PresentationNotes teamId={play.teamId} playId={play.id} />}
            </div>
            <div className={cn('w-full', presenting && 'mx-auto max-w-4xl')}>
              <PlaybackBar
                playback={playback}
                large={presenting}
                trails={showTrails}
                onToggleTrails={() => setShowTrails((value) => !value)}
              />
            </div>
            <div className={cn('w-full', presenting && 'mx-auto max-w-4xl')}>
              <FocusBar large={presenting} />
            </div>
          </div>
          <TimelinePanel playback={playback} />
        </div>

        <aside className="flex flex-col gap-4 lg:w-72">
          <section className="rounded-2xl bg-surface p-4 ring-1 ring-slate-200">
            <PlayerPanel />
          </section>
          <SidePanel teamId={play.teamId} side={side} ruleset={ruleset} />
          <NotesPanel
            teamId={play.teamId}
            playId={play.id}
            onSaveConcepts={autosave.saveConcepts}
          />
        </aside>
      </div>
    </EditorContext>
  );
}

/** Cabecera del modo presentación: nombre de la jugada, momento actual y salir. */
function PresentationHeader({
  title,
  playback,
  onExit,
}: {
  title: string;
  playback: Playback;
  onExit: () => void;
}) {
  const moment = playback.time === null ? null : momentAt(playback.moments, playback.time);
  return (
    <div className="flex items-center justify-between gap-3 text-white">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="truncate text-xl font-bold sm:text-2xl">{title}</h2>
        <AnimatePresence mode="wait">
          {moment && (
            <motion.span
              key={moment.label}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="shrink-0 rounded-full bg-amber-400 px-3 py-0.5 text-sm font-bold text-amber-950 sm:text-base"
            >
              {moment.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <Button
        variant="secondary"
        onClick={onExit}
        aria-label="Salir del modo presentación"
        title="Salir (Esc)"
      >
        <Minimize2 aria-hidden className="size-5" />
        Salir
      </Button>
    </div>
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

type Picking = { title: string; hint: string; emptyLabel: string; unit: 'O' | 'D' };

/** Formación propia, rival (o en special teams, quien patea y quien recibe) y añadir jugadores. */
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
  const [pickingKey, setPicking] = useState<'own' | 'rival' | null>(null);
  const special = side === 'special';
  const own: Picking = special
    ? {
        title: 'Equipo que patea',
        hint: 'Punt, kickoff o field goal. Los jugadores conservan sus rutas.',
        emptyLabel: 'Quitar a todos',
        unit: 'O',
      }
    : {
        title: 'Cambiar formación',
        hint: 'Los jugadores se mueven a la nueva formación y conservan sus rutas.',
        emptyLabel: 'Quitar a todos',
        unit: ownSide,
      };
  const rival: Picking = special
    ? {
        title: 'Equipo que recibe',
        hint: 'Punt return, kick return o field goal block, campo abajo.',
        emptyLabel: 'Sin equipo que recibe',
        unit: 'D',
      }
    : {
        title: 'Poner rival',
        hint: 'Coloca al rival enfrente para explicar contra qué se corre la jugada.',
        emptyLabel: 'Sin rival',
        unit: ownSide === 'O' ? 'D' : 'O',
      };
  const picking = pickingKey === 'own' ? own : pickingKey === 'rival' ? rival : null;
  const pickingSide = pickingKey === 'rival' && !special ? RIVAL_SIDE[side] : side;

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4 ring-1 ring-slate-200">
      <h2 className="mb-1 font-semibold">Cancha</h2>
      <Button variant="secondary" className="justify-start" onClick={() => setPicking('own')}>
        <Users aria-hidden className="size-4" />
        {special ? own.title : `Formación (${SIDE_LABELS[side].toLowerCase()})`}
      </Button>
      <Button variant="secondary" className="justify-start" onClick={() => setPicking('rival')}>
        <Shield aria-hidden className="size-4" />
        {special ? rival.title : `Poner rival (${SIDE_LABELS[RIVAL_SIDE[side]].toLowerCase()})`}
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
      <YardLineSlider />

      <Modal open={picking !== null} title={picking?.title ?? ''} onClose={() => setPicking(null)}>
        <p className="mb-4 text-sm text-slate-600">{picking?.hint}</p>
        {picking && (
          <FormationPicker
            teamId={teamId}
            side={pickingSide}
            ruleset={ruleset}
            value={null}
            unit={special ? picking.unit : undefined}
            emptyLabel={picking.emptyLabel}
            onChange={(_id, formation) => {
              const unit = picking.unit;
              apply((diagram) =>
                formation
                  ? applyFormation(diagram, formation.players, unit)
                  : diagram.players
                      .filter((player) => player.side === unit)
                      .reduce((current, player) => removePlayer(current, player.id), diagram),
              );
              setPicking(null);
            }}
          />
        )}
      </Modal>
    </section>
  );
}

/** "Propia 25", "Medio campo" o "Rival 30": cómo dicen los coaches dónde está el balón. */
function yardLineLabel(yardLine: number): string {
  if (yardLine === 50) return 'Medio campo';
  return yardLine < 50 ? `Propia ${yardLine}` : `Rival ${100 - yardLine}`;
}

/** Dónde está el balón en el campo. Importa para ver la end zone y apuntar un field goal. */
function YardLineSlider() {
  const yardLine = useEditor((state) => state.diagram.field.yardLine);
  const apply = useEditor((state) => state.apply);
  const [draft, setDraft] = useState(yardLine);
  const [seen, setSeen] = useState(yardLine);
  if (seen !== yardLine) {
    setSeen(yardLine);
    setDraft(yardLine);
  }
  // Se aplica al soltar: arrastrar deja un solo paso en "Deshacer".
  const commit = () => {
    if (draft !== yardLine) apply((diagram) => setYardLine(diagram, draft));
  };
  return (
    <label className="mt-1 flex flex-col gap-1 text-sm font-medium text-slate-700">
      <span className="flex justify-between">
        Balón en
        <span className="text-slate-500 tabular-nums">{yardLineLabel(draft)}</span>
      </span>
      <input
        type="range"
        className="h-8 accent-turf-700"
        min={1}
        max={99}
        step={1}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  );
}

/**
 * Ctrl/Cmd+Z deshace, Ctrl/Cmd+Shift+Z o Ctrl+Y rehace, Supr borra lo seleccionado,
 * Espacio reproduce o pausa la jugada, las flechas saltan entre momentos clave y Escape
 * deselecciona.
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
      } else if (
        (event.key === 'ArrowRight' || event.key === 'ArrowLeft') &&
        // Las barras de la línea de tiempo usan las flechas para moverse.
        !event.defaultPrevented
      ) {
        if (!playbackRef.current.canPlay) return;
        event.preventDefault();
        playbackRef.current.step(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Escape') {
        state.select(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);
}
