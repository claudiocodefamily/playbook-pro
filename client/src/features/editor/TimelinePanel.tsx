import type { PlayDiagram } from '@playbook/shared';
import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { type BallFlight, ballFlights } from '../field/ball';
import { isPathAssignment, type PathAssignment } from '../field/paths';
import { setAssignmentTiming, setBallTime } from './diagram-ops';
import { useEditor } from './editor-context';
import type { Playback } from './usePlayback';

const BAR_STYLES: Readonly<Record<PathAssignment['type'], string>> = {
  route: 'bg-turf-600 text-white',
  block: 'bg-gray-500 text-white',
  motion: 'bg-sky-500 text-white',
  blitz: 'bg-red-500 text-white',
};
const TYPE_LABELS: Readonly<Record<PathAssignment['type'], string>> = {
  route: 'Ruta',
  block: 'Bloqueo',
  motion: 'Motion',
  blitz: 'Blitz',
};
const BALL_LABELS = {
  snap: 'Snap',
  handoff: 'Handoff',
  pitch: 'Pitch',
  pass: 'Pase',
  kick: 'Patada',
  fumble: 'Fumble',
};
/** Paso de las flechas del teclado sobre una barra, en segundos. */
const KEY_STEP = 0.1;
/** Menos de esto al soltar cuenta como un toque (seleccionar), no como un arrastre. */
const CLICK_PX = 4;

interface Axis {
  start: number;
  end: number;
}

type DragTarget = { kind: 'move' | 'end'; id: string } | { kind: 'ball'; index: number };
type Drag = DragTarget & {
  originX: number;
  pxPerSecond: number;
  /** Segundos arrastrados desde que empezó. */
  dt: number;
  /** El eje no cambia mientras se arrastra (si no, la barra "huiría" del dedo). */
  axis: Axis;
};

/**
 * Línea de tiempo de la jugada: una fila por jugador con sus trazos como barras. Arrastrar
 * una barra cambia cuándo sale el jugador; arrastrar su borde derecho, cuánto tarda. La
 * fila del balón marca cuándo sale cada entrega o pase.
 */
export function TimelinePanel({ playback }: { playback: Playback }) {
  const diagram = useEditor((state) => state.diagram);
  const selectedAssignmentId = useEditor((state) => state.selectedAssignmentId);
  const apply = useEditor((state) => state.apply);
  const selectAssignment = useEditor((state) => state.selectAssignment);
  const [drag, setDrag] = useState<Drag | null>(null);

  const preview = useMemo(() => (drag ? applyDrag(diagram, drag) : diagram), [diagram, drag]);
  const flights = useMemo(() => ballFlights(preview), [preview]);
  const liveAxis: Axis = {
    start: Math.min(0, playback.range.start),
    end: Math.max(4, playback.range.end + 1),
  };
  const axis = drag?.axis ?? liveAxis;
  const percent = (t: number) => ((t - axis.start) / (axis.end - axis.start)) * 100;

  const rows = preview.players
    .map((player) => ({
      player,
      paths: preview.assignments
        .filter(isPathAssignment)
        .filter((assignment) => assignment.playerId === player.id),
    }))
    .filter((row) => row.paths.length > 0)
    .sort((a, b) =>
      a.player.side === b.player.side ? a.player.x - b.player.x : a.player.side === 'O' ? -1 : 1,
    );

  const startDrag = (event: React.PointerEvent<HTMLElement>, target: DragTarget) => {
    const track = event.currentTarget.closest('[data-track]');
    if (!track) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const width = track.getBoundingClientRect().width;
    setDrag({
      ...target,
      originX: event.clientX,
      pxPerSecond: width / (liveAxis.end - liveAxis.start),
      dt: 0,
      axis: liveAxis,
    });
  };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag) return;
    setDrag({ ...drag, dt: (event.clientX - drag.originX) / drag.pxPerSecond });
  };
  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const moved = Math.abs(event.clientX - drag.originX) >= CLICK_PX;
    if (moved) apply((current) => applyDrag(current, drag));
    else if (drag.kind !== 'ball') selectAssignment(drag.id);
    setDrag(null);
  };

  if (rows.length === 0 && flights.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-sm text-slate-600 ring-1 ring-slate-200">
        <Clock aria-hidden className="size-5 shrink-0 text-turf-700 dark:text-turf-300" />
        Cuando dibujes rutas aparecerán aquí. Podrás arrastrarlas para decidir cuándo sale cada
        jugador y cuánto tarda.
      </section>
    );
  }

  const seconds = Array.from(
    { length: Math.floor(axis.end) - Math.ceil(axis.start) + 1 },
    (_, i) => Math.ceil(axis.start) + i,
  );
  const playhead = playback.time;

  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-slate-200">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Tiempos</h2>
        <p className="text-xs text-slate-500">
          Arrastra una barra para cambiar cuándo sale; su borde derecho, para cuánto tarda.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* Eje: segundos y momentos. Tocarlo mueve la animación a ese instante. */}
        <Row label="">
          <div
            data-track
            className="relative h-7 cursor-pointer select-none"
            onPointerDown={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const t =
                axis.start + ((event.clientX - box.left) / box.width) * (axis.end - axis.start);
              playback.seek(Math.min(playback.range.end, Math.max(playback.range.start, t)));
            }}
          >
            {seconds.map((second) => (
              <span
                key={second}
                className={cn(
                  'absolute top-0 -translate-x-1/2 text-[11px] tabular-nums',
                  second === 0 ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-slate-400',
                )}
                style={{ left: `${percent(second)}%` }}
              >
                {second === 0 ? 'Snap' : `${second > 0 ? '+' : ''}${second}s`}
              </span>
            ))}
            {playback.moments
              .filter((moment) => moment.label !== 'Snap')
              .map((moment) => (
                <span
                  key={`${moment.label}-${moment.t}`}
                  title={moment.label}
                  className="absolute bottom-0 h-2 w-0.5 -translate-x-1/2 bg-amber-400"
                  style={{ left: `${percent(moment.t)}%` }}
                />
              ))}
          </div>
        </Row>

        {rows.map(({ player, paths }) => (
          <Row key={player.id} label={player.label} defense={player.side === 'D'}>
            <Track percent={percent} playhead={playhead}>
              {paths.map((path) => {
                const left = percent(path.startTime);
                const width = Math.max(percent(path.endTime) - left, 1.5);
                const rival =
                  path.type === 'block' && path.targetPlayerId
                    ? diagram.players.find((candidate) => candidate.id === path.targetPlayerId)
                    : undefined;
                const name =
                  path.type === 'route' && path.routeName
                    ? path.routeName
                    : rival
                      ? `Bloqueo a ${rival.label}`
                      : TYPE_LABELS[path.type];
                return (
                  <button
                    key={path.id}
                    type="button"
                    aria-label={`${TYPE_LABELS[path.type]} de ${player.label}, de ${path.startTime.toFixed(1)} a ${path.endTime.toFixed(1)} s`}
                    title="Arrástrala para cambiar cuándo sale. Con el teclado: flechas (y Mayús + flechas para la duración)."
                    className={cn(
                      'absolute top-1 bottom-1 flex cursor-grab touch-none items-center overflow-hidden rounded-lg px-2 text-left text-xs font-semibold whitespace-nowrap shadow-sm active:cursor-grabbing',
                      BAR_STYLES[path.type],
                      path.id === selectedAssignmentId && 'ring-2 ring-sky-400 ring-offset-1',
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onPointerDown={(event) =>
                      startDrag(event, {
                        kind: 'move',
                        id: path.id,
                      })
                    }
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                      event.preventDefault();
                      const delta = event.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP;
                      apply((current) =>
                        setAssignmentTiming(current, path.id, {
                          startTime: path.startTime + (event.shiftKey ? 0 : delta),
                          endTime: path.endTime + delta,
                        }),
                      );
                    }}
                  >
                    {name}
                    {path.type !== 'motion' && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 right-0 w-3 cursor-ew-resize bg-black/15"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          startDrag(event, {
                            kind: 'end',
                            id: path.id,
                          });
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </Track>
          </Row>
        ))}

        {flights.length > 0 && (
          <Row label="Balón" ball>
            <Track percent={percent} playhead={playhead}>
              {flights.map((flight, index) => (
                <BallMarker
                  key={`${index}-${flight.toPlayerId}`}
                  flight={flight}
                  receiver={
                    flight.toPlayerId === null
                      ? 'portería'
                      : diagram.players.find((p) => p.id === flight.toPlayerId)?.label
                  }
                  left={percent(flight.releaseTime)}
                  width={Math.max(percent(flight.catchTime) - percent(flight.releaseTime), 0.8)}
                  onPointerDown={
                    flight.action === 'snap'
                      ? undefined
                      : (event) =>
                          startDrag(event, {
                            kind: 'ball',
                            index,
                          })
                  }
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                />
              ))}
            </Track>
          </Row>
        )}
      </div>
    </section>
  );
}

/** Aplica un arrastre al diagram (con las mismas reglas que al soltar). */
function applyDrag(diagram: PlayDiagram, drag: Drag): PlayDiagram {
  if (drag.kind === 'ball') {
    const entry = [...diagram.ball.carrierTimeline].sort((a, b) => a.t - b.t)[drag.index];
    return entry ? setBallTime(diagram, drag.index, entry.t + drag.dt) : diagram;
  }
  const path = diagram.assignments.find((assignment) => assignment.id === drag.id);
  if (!path) return diagram;
  return setAssignmentTiming(diagram, drag.id, {
    startTime: path.startTime + (drag.kind === 'move' ? drag.dt : 0),
    endTime: path.endTime + drag.dt,
  });
}

function Row({
  label,
  defense = false,
  ball = false,
  children,
}: {
  label: string;
  defense?: boolean;
  ball?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'w-12 shrink-0 truncate text-center text-xs font-bold',
          defense
            ? 'text-amber-700 dark:text-amber-400'
            : ball
              ? 'text-amber-900 dark:text-amber-200'
              : 'text-slate-700',
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Track({
  percent,
  playhead,
  children,
}: {
  percent: (t: number) => number;
  playhead: number | null;
  children: React.ReactNode;
}) {
  return (
    <div data-track className="relative h-9 rounded-lg bg-slate-100">
      <span
        aria-hidden
        className="absolute inset-y-0 w-0.5 bg-amber-400/70"
        style={{ left: `${percent(0)}%` }}
      />
      {children}
      {playhead !== null && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-y-1 z-10 w-0.5 bg-sky-500"
          style={{ left: `${percent(playhead)}%` }}
        />
      )}
    </div>
  );
}

function BallMarker({
  flight,
  receiver,
  left,
  width,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  flight: BallFlight;
  receiver: string | undefined;
  left: number;
  width: number;
  onPointerDown: ((event: React.PointerEvent<HTMLElement>) => void) | undefined;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <div
      aria-label={`${BALL_LABELS[flight.action]} a ${receiver ?? '?'}`}
      title={onPointerDown ? 'Arrástralo para cambiar cuándo sale el balón' : undefined}
      className={cn(
        'absolute top-1 bottom-1 flex touch-none items-center gap-1 overflow-visible rounded-lg bg-amber-200/80 pl-1 dark:bg-amber-500/40 text-[11px] font-semibold whitespace-nowrap text-amber-900 dark:text-amber-100',
        onPointerDown && 'cursor-grab',
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span aria-hidden className="size-2.5 shrink-0 rotate-45 bg-amber-700 dark:bg-amber-300" />
      {BALL_LABELS[flight.action]} → {receiver}
    </div>
  );
}
