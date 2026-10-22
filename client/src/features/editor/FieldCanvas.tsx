import type { DiagramPlayer, Point, Ruleset } from '@playbook/shared';
import Konva from 'konva';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import {
  FIELD_WIDTH,
  type FieldWindow,
  fromScreen,
  hashMarksX,
  toScreen,
  yardLines,
} from '../field/geometry';
import { ballAt, ballFlights, snapSpot } from '../field/ball';
import {
  chainEnd,
  isPathAssignment,
  pathOrigins,
  positionsAt,
  type PathAssignment,
} from '../field/paths';
import { addPathAssignment, movePlayer, snapAndClamp } from './diagram-ops';
import { useEditor } from './editor-context';

const PLAYER_RADIUS = 1; // yardas: con la línea a 2 yardas, los jugadores se tocan sin solaparse
const MIN_RADIUS = 12; // px, para que la etiqueta se lea en un móvil
const MIN_TOUCH_RADIUS = 22; // px: zona táctil invisible, aunque la cancha se vea pequeña
const COLORS = {
  turf: '#24642f',
  chalk: '#f8fafc',
  firstDown: '#facc15',
  offense: '#ffffff',
  defense: '#facc15',
  selected: '#38bdf8',
  ink: '#0f172a',
  draft: '#38bdf8',
  ball: '#8b4513',
  ballDark: '#3b1d0a',
  pass: '#fde68a',
};
/** Distancia mínima entre puntos al dibujar con el dedo, para no guardar cientos. */
const DRAW_SAMPLE_PX = 4;

interface Draft {
  playerId: string;
  /** Dónde empieza el trazo en pantalla: el jugador o el final de su trazo anterior. */
  origin: { x: number; y: number };
  /** Lo que va dibujando el dedo, en píxeles. */
  raw: { x: number; y: number }[];
}

interface FieldCanvasProps {
  ruleset: Ruleset;
  window: FieldWindow;
  /** Segundo de la animación que se está mostrando, o null si no se reproduce. */
  playbackTime: number | null;
}

/**
 * La cancha interactiva. Con la herramienta "Mover" se arrastran jugadores; con las de
 * dibujo se arrastra desde un jugador para trazar su ruta, bloqueo, motion o blitz.
 */
export function FieldCanvas({ ruleset, window, playbackTime }: FieldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);
  const diagram = useEditor((state) => state.diagram);
  const selectedId = useEditor((state) => state.selectedId);
  const selectedAssignmentId = useEditor((state) => state.selectedAssignmentId);
  const tool = useEditor((state) => state.tool);
  const select = useEditor((state) => state.select);
  const selectAssignment = useEditor((state) => state.selectAssignment);
  const apply = useEditor((state) => state.apply);
  // El trazo en curso vive en un ref (para leerlo al instante en cada evento del puntero)
  // y en el estado (para pintarlo).
  const draftRef = useRef<Draft | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  // Al soltar un trazo sobre la hierba, Konva también lanza un "click" en la cancha que
  // deseleccionaría lo recién dibujado: se ignora si llega justo después de dibujar.
  const drewAt = useRef(0);
  const setDraft = (next: Draft | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const scale = width / FIELD_WIDTH; // px por yarda
  const height = (window.maxY - window.minY) * scale;
  const px = (point: { x: number; y: number }) => {
    const screen = toScreen(point, window);
    return { x: screen.x * scale, y: screen.y * scale };
  };
  const toDiagram = (screen: { x: number; y: number }): Point =>
    fromScreen({ x: screen.x / scale, y: screen.y / scale }, window);
  const origins = pathOrigins(diagram);
  const positions = playbackTime === null ? null : positionsAt(diagram, playbackTime);
  const flights = useMemo(() => ballFlights(diagram), [diagram]);
  const hasOffense = diagram.players.some((player) => player.side === 'O');
  const ball =
    playbackTime === null
      ? { position: snapSpot(diagram), height: 0, holderId: null }
      : ballAt(diagram, playbackTime, flights);
  const playerRadius = Math.max(PLAYER_RADIUS * scale, MIN_RADIUS);
  const losY = px({ x: 0, y: 0 }).y;
  const drawing = tool !== 'move';

  const startDraw = (playerId: string, pointer: { x: number; y: number }) => {
    if (playbackTime !== null || tool === 'move') return;
    const player = diagram.players.find((candidate) => candidate.id === playerId);
    const origin = tool === 'motion' ? player : chainEnd(diagram, playerId);
    if (!origin) return;
    setDraft({ playerId, origin: px(origin), raw: [pointer] });
  };

  const finishDraw = () => {
    const active = draftRef.current;
    if (!active || tool === 'move') return;
    setDraft(null);
    drewAt.current = performance.now();
    // Lo dibujado se pega al origen: da igual dónde empezó el dedo exactamente.
    const start = active.raw[0] ?? active.origin;
    const points = active.raw.map((point) =>
      toDiagram({
        x: active.origin.x + point.x - start.x,
        y: active.origin.y + point.y - start.y,
      }),
    );
    let addedId: string | null = null;
    apply((current) => {
      const added = addPathAssignment(current, { playerId: active.playerId, type: tool, points });
      if (!added) return current;
      addedId = added.assignmentId;
      return added.diagram;
    });
    // Un toque sin arrastrar selecciona al jugador; un trazo selecciona lo dibujado.
    if (addedId) selectAssignment(addedId);
    else select(active.playerId);
  };

  const deselectOnField = (target: Konva.Node) => {
    if (target !== target.getStage() || performance.now() - drewAt.current < 300) return;
    select(null);
  };

  return (
    <div ref={containerRef} className="w-full touch-none overflow-hidden rounded-2xl bg-turf-700">
      {width > 0 && (
        <Stage
          width={width}
          height={height}
          onClick={(event) => deselectOnField(event.target)}
          onTap={(event) => deselectOnField(event.target)}
          onPointerMove={(event) => {
            const active = draftRef.current;
            if (!active) return;
            const pointer = event.target.getStage()?.getPointerPosition();
            const last = active.raw.at(-1);
            if (!pointer || !last) return;
            if (Math.hypot(pointer.x - last.x, pointer.y - last.y) < DRAW_SAMPLE_PX) return;
            setDraft({ ...active, raw: [...active.raw, pointer] });
          }}
          onPointerUp={finishDraw}
          onPointerLeave={finishDraw}
        >
          <Layer listening={false}>
            <Rect width={width} height={height} fill={COLORS.turf} />
            {yardLines(window).map((line) => {
              const y = px({ x: 0, y: line }).y;
              return (
                <Line
                  key={line}
                  points={[0, y, width, y]}
                  stroke={COLORS.chalk}
                  opacity={0.25}
                  strokeWidth={1.5}
                />
              );
            })}
            {hashMarksX(ruleset).flatMap((hashX) =>
              Array.from({ length: Math.floor(window.maxY - window.minY) + 1 }, (_, i) => {
                const { x, y } = px({ x: hashX, y: window.minY + i });
                return (
                  <Line
                    key={`${hashX}-${i}`}
                    points={[x - 0.5 * scale, y, x + 0.5 * scale, y]}
                    stroke={COLORS.chalk}
                    opacity={0.45}
                    strokeWidth={1.5}
                  />
                );
              }),
            )}
            <Line
              points={[0, losY, width, losY]}
              stroke={COLORS.firstDown}
              strokeWidth={3}
              dash={[scale, scale * 0.6]}
            />
          </Layer>

          <Layer listening={!drawing && playbackTime === null}>
            {diagram.assignments.filter(isPathAssignment).map((assignment) => {
              const origin = origins.get(assignment.id);
              if (!origin) return null;
              return (
                <AssignmentShape
                  key={assignment.id}
                  assignment={assignment}
                  points={[origin, ...assignment.points].map(px)}
                  scale={scale}
                  selected={assignment.id === selectedAssignmentId}
                  dimmed={playbackTime !== null}
                  onSelect={() => selectAssignment(assignment.id)}
                />
              );
            })}
            {playbackTime === null &&
              flights
                .filter((flight) => flight.action === 'pass' || flight.action === 'pitch')
                .map((flight) => {
                  const from = px(flight.from);
                  const to = px(flight.to);
                  return (
                    <Group key={`${flight.toPlayerId}-${flight.releaseTime}`} listening={false}>
                      <Line
                        points={[from.x, from.y, to.x, to.y]}
                        stroke={COLORS.pass}
                        strokeWidth={2}
                        dash={[6, 5]}
                        opacity={0.9}
                      />
                      <Circle x={to.x} y={to.y} radius={4} fill={COLORS.pass} />
                    </Group>
                  );
                })}
            {draft && (
              <Line
                points={[
                  draft.origin,
                  ...draft.raw.map((point) => ({
                    x: draft.origin.x + point.x - (draft.raw[0]?.x ?? 0),
                    y: draft.origin.y + point.y - (draft.raw[0]?.y ?? 0),
                  })),
                ].flatMap(({ x, y }) => [x, y])}
                stroke={COLORS.draft}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
                dash={tool === 'motion' ? [scale, scale * 0.6] : undefined}
                listening={false}
              />
            )}
          </Layer>

          <Layer>
            {diagram.players.map((player) => (
              <PlayerNode
                key={player.id}
                player={player}
                position={px(positions?.get(player.id) ?? player)}
                instant={positions !== null}
                draggable={!drawing && playbackTime === null}
                drawing={drawing}
                radius={playerRadius}
                selected={player.id === selectedId}
                toDiagram={toDiagram}
                toScreen={px}
                bounds={{ width, height }}
                onStartDraw={startDraw}
              />
            ))}
          </Layer>

          {hasOffense && (
            <Layer listening={false}>
              <Ball
                position={px(ball.position)}
                height={ball.height}
                held={ball.holderId !== null}
                size={Math.max(0.45 * scale, 7)}
                playerRadius={playerRadius}
              />
            </Layer>
          )}
        </Stage>
      )}
    </div>
  );
}

/**
 * El balón. En el aire crece y proyecta sombra para que se vea el arco del pase; en manos
 * de un jugador se dibuja pegado a su círculo para no taparle la etiqueta.
 */
function Ball({
  position,
  height,
  held,
  size,
  playerRadius,
}: {
  position: { x: number; y: number };
  height: number;
  held: boolean;
  size: number;
  playerRadius: number;
}) {
  const lift = height * size * 2.5;
  const x = position.x + (held ? playerRadius * 0.75 : 0);
  const y = position.y - (held ? playerRadius * 0.75 : 0) - lift;
  const grow = 1 + height * 0.7;
  return (
    <>
      {height > 0 && (
        <Ellipse
          x={position.x}
          y={position.y}
          radiusX={size * 0.9}
          radiusY={size * 0.45}
          fill="black"
          opacity={0.25}
        />
      )}
      <Group x={x} y={y} scaleX={grow} scaleY={grow} rotation={-35}>
        <Ellipse
          radiusX={size}
          radiusY={size * 0.62}
          fill={COLORS.ball}
          stroke={COLORS.ballDark}
          strokeWidth={1.5}
          shadowColor="black"
          shadowOpacity={0.35}
          shadowBlur={3}
        />
        <Line points={[-size * 0.4, 0, size * 0.4, 0]} stroke="white" strokeWidth={1.5} />
        {[-0.25, 0, 0.25].map((offset) => (
          <Line
            key={offset}
            points={[size * offset, -size * 0.18, size * offset, size * 0.18]}
            stroke="white"
            strokeWidth={1.2}
          />
        ))}
      </Group>
    </>
  );
}

interface AssignmentShapeProps {
  assignment: PathAssignment;
  /** En píxeles, empezando por el origen del trazo. */
  points: { x: number; y: number }[];
  scale: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}

/** Una ruta, motion, blitz o bloqueo: línea con flecha, con T de bloqueo o sin final. */
function AssignmentShape({
  assignment,
  points,
  scale,
  selected,
  dimmed,
  onSelect,
}: AssignmentShapeProps) {
  const { style } = assignment;
  const color = selected ? COLORS.selected : (style.color ?? COLORS.chalk);
  const flat = points.flatMap(({ x, y }) => [x, y]);
  const dash =
    style.line === 'dashed'
      ? [scale, scale * 0.6]
      : style.line === 'dotted'
        ? [2, scale * 0.5]
        : undefined;
  const common = {
    points: flat,
    stroke: color,
    strokeWidth: selected ? 4.5 : 3,
    tension: style.curved ? 0.4 : 0,
    dash,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    hitStrokeWidth: 24,
    opacity: dimmed ? 0.35 : 1,
    shadowColor: selected ? COLORS.selected : undefined,
    shadowBlur: selected ? 10 : 0,
  };
  const end = points.at(-1);
  const beforeEnd = points.at(-2);
  // La T del bloqueo: una barra perpendicular al último tramo.
  let blockBar: number[] | null = null;
  if (style.end === 'block' && end && beforeEnd) {
    const dx = end.x - beforeEnd.x;
    const dy = end.y - beforeEnd.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = Math.max(8, 0.9 * scale);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    blockBar = [end.x - nx, end.y - ny, end.x + nx, end.y + ny];
  }
  const routeName = assignment.type === 'route' ? assignment.routeName : undefined;
  const select = () => onSelect();

  return (
    <Group onClick={select} onTap={select}>
      {style.end === 'arrow' ? (
        <Arrow {...common} fill={color} pointerLength={10} pointerWidth={10} />
      ) : (
        <Line {...common} />
      )}
      {blockBar && (
        <Line
          points={blockBar}
          stroke={color}
          strokeWidth={common.strokeWidth}
          lineCap="round"
          opacity={common.opacity}
          hitStrokeWidth={24}
        />
      )}
      {routeName && end && (
        <Text
          text={routeName}
          x={end.x + 8}
          y={end.y - 18}
          fontSize={Math.max(11, 0.9 * scale)}
          fontStyle="bold"
          fill={color}
          opacity={common.opacity}
          shadowColor="black"
          shadowBlur={3}
          shadowOpacity={0.6}
        />
      )}
    </Group>
  );
}

interface PlayerNodeProps {
  player: DiagramPlayer;
  position: { x: number; y: number };
  /** true durante la animación: la posición cambia en cada fotograma, sin deslizamiento. */
  instant: boolean;
  draggable: boolean;
  /** Hay una herramienta de dibujo activa: tocar al jugador empieza un trazo. */
  drawing: boolean;
  radius: number;
  selected: boolean;
  toDiagram: (screen: { x: number; y: number }) => { x: number; y: number };
  toScreen: (point: { x: number; y: number }) => { x: number; y: number };
  bounds: { width: number; height: number };
  onStartDraw: (playerId: string, pointer: { x: number; y: number }) => void;
}

/**
 * Un jugador. La posición no se pasa como prop controlada: cuando cambia (otra formación,
 * deshacer...), el jugador se desliza hasta su sitio nuevo en vez de saltar.
 */
function PlayerNode({
  player,
  position,
  instant,
  draggable,
  drawing,
  radius,
  selected,
  toDiagram,
  toScreen: toPx,
  bounds,
  onStartDraw,
}: PlayerNodeProps) {
  const ref = useRef<Konva.Group>(null);
  const tween = useRef<Konva.Tween | null>(null);
  const placed = useRef(false);
  const dragging = useRef(false);
  const apply = useEditor((state) => state.apply);
  const select = useEditor((state) => state.select);

  const { x, y } = position;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || dragging.current) return;
    if (!placed.current) {
      node.position({ x, y });
      node.scale({ x: 0.3, y: 0.3 });
      node.to({ scaleX: 1, scaleY: 1, duration: 0.25, easing: Konva.Easings.BackEaseOut });
      placed.current = true;
      return;
    }
    tween.current?.destroy();
    tween.current = null;
    if (instant) {
      node.position({ x, y });
      return;
    }
    tween.current = new Konva.Tween({
      node,
      x,
      y,
      duration: 0.35,
      easing: Konva.Easings.EaseInOut,
    });
    tween.current.play();
  }, [x, y, instant]);

  const offense = player.side === 'O';
  const fontSize =
    radius * (player.label.length <= 2 ? 0.85 : player.label.length === 3 ? 0.7 : 0.55);

  return (
    <Group
      ref={ref}
      draggable={draggable}
      onPointerDown={(event) => {
        if (!drawing) return;
        const pointer = event.target.getStage()?.getPointerPosition();
        if (pointer) onStartDraw(player.id, pointer);
      }}
      dragBoundFunc={(pos) => ({
        x: Math.min(bounds.width, Math.max(0, pos.x)),
        y: Math.min(bounds.height, Math.max(0, pos.y)),
      })}
      onDragStart={(event) => {
        dragging.current = true;
        select(player.id);
        event.target.moveToTop();
        event.target.to({ scaleX: 1.15, scaleY: 1.15, duration: 0.1 });
      }}
      onDragEnd={(event) => {
        dragging.current = false;
        const node = event.target;
        // Encaja en la media yarda más cercana con un pequeño deslizamiento.
        const target = snapAndClamp(toDiagram(node.position()));
        node.to({ ...toPx(target), scaleX: 1, scaleY: 1, duration: 0.12 });
        apply((diagram) => movePlayer(diagram, player.id, target));
      }}
      onClick={() => !drawing && select(player.id)}
      onTap={() => !drawing && select(player.id)}
      onMouseEnter={(event) => {
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = drawing ? 'crosshair' : draggable ? 'grab' : '';
      }}
      onMouseLeave={(event) => {
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = '';
      }}
    >
      {/* Zona táctil: más grande que el círculo para acertar con el dedo. */}
      <Circle radius={Math.max(radius, MIN_TOUCH_RADIUS)} fill="transparent" />
      {selected && (
        <Circle
          radius={radius + 5}
          stroke={COLORS.selected}
          strokeWidth={4}
          shadowColor={COLORS.selected}
          shadowBlur={12}
        />
      )}
      <Circle
        radius={radius}
        fill={offense ? COLORS.offense : COLORS.defense}
        stroke={COLORS.ink}
        strokeWidth={2}
        shadowColor="black"
        shadowOpacity={0.3}
        shadowBlur={4}
        shadowOffsetY={2}
      />
      <Text
        text={player.label}
        fontSize={fontSize}
        fontStyle="bold"
        fill={COLORS.ink}
        width={radius * 2}
        height={radius * 2}
        offsetX={radius}
        offsetY={radius}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry?.contentRect.width ?? 0)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
