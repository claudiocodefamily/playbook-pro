import {
  type DiagramPlayer,
  GOAL_POST_HALF_WIDTH_YARDS,
  goalLineY,
  goalPostsY,
  type Point,
  type Ruleset,
} from '@playbook/shared';
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
import { animatedPositions, type CoverageAssignment, isCoverage } from '../field/coverage';
import { sampleTrails, trailsAt } from '../field/trails';
import { chainEnd, isPathAssignment, pathOrigins, type PathAssignment } from '../field/paths';
import {
  addManCoverage,
  addPathAssignment,
  addZoneCoverage,
  MIN_PATH_YARDS,
  movePlayer,
  moveZone,
  snapAndClamp,
} from './diagram-ops';
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
  endZone: '#1d5027',
  coverage: '#fbbf24',
};
/** Al soltar un marcaje, se engancha al jugador de ataque más cercano dentro de esta distancia. */
const MAN_SNAP_YARDS = 3;
/** Distancia mínima entre puntos al dibujar con el dedo, para no guardar cientos. */
const DRAW_SAMPLE_PX = 4;

interface Draft {
  playerId: string;
  /**
   * Dónde empieza el trazo en pantalla: el jugador o el final de su trazo anterior. En las
   * coberturas, el defensor.
   */
  origin: { x: number; y: number };
  /** Lo que va dibujando el dedo, en píxeles. */
  raw: { x: number; y: number }[];
}

interface FieldCanvasProps {
  ruleset: Ruleset;
  window: FieldWindow;
  /** Segundo de la animación que se está mostrando, o null si no se reproduce. */
  playbackTime: number | null;
  /** Dibuja por dónde ha pasado cada jugador durante la animación. */
  showTrails: boolean;
}

/**
 * La cancha interactiva. Con la herramienta "Mover" se arrastran jugadores; con las de
 * dibujo se arrastra desde un jugador para trazar su ruta, bloqueo, motion o blitz.
 */
export function FieldCanvas({ ruleset, window, playbackTime, showTrails }: FieldCanvasProps) {
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
  const positions = playbackTime === null ? null : animatedPositions(diagram, playbackTime);
  const positionOf = (player: DiagramPlayer): Point => positions?.get(player.id) ?? player;
  const flights = useMemo(() => ballFlights(diagram), [diagram]);
  // Las muestras de la estela se calculan una vez por jugada, no en cada fotograma.
  const samples = useMemo(() => (showTrails ? sampleTrails(diagram) : null), [diagram, showTrails]);
  const trails =
    samples && positions && playbackTime !== null
      ? trailsAt(samples, playbackTime, positions)
      : null;
  const hasOffense = diagram.players.some((player) => player.side === 'O');
  const ball =
    playbackTime === null
      ? { position: snapSpot(diagram), height: 0, holderId: null }
      : ballAt(diagram, playbackTime, flights);
  const playerRadius = Math.max(PLAYER_RADIUS * scale, MIN_RADIUS);
  const losY = px({ x: 0, y: 0 }).y;
  const goal = goalLineY(diagram.field.yardLine);
  const drawing = tool !== 'move';
  const coverageTool = tool === 'man' || tool === 'zone';

  const startDraw = (playerId: string, pointer: { x: number; y: number }) => {
    if (playbackTime !== null || tool === 'move') return;
    const player = diagram.players.find((candidate) => candidate.id === playerId);
    // Las coberturas solo salen de un defensor.
    if (coverageTool && player?.side !== 'D') return;
    const origin = tool === 'motion' || coverageTool ? player : chainEnd(diagram, playerId);
    if (!origin) return;
    setDraft({ playerId, origin: px(origin), raw: [pointer] });
  };

  const finishDraw = () => {
    const active = draftRef.current;
    if (!active || tool === 'move') return;
    setDraft(null);
    drewAt.current = performance.now();
    let addedId: string | null = null;
    if (tool === 'man' || tool === 'zone') {
      const end = toDiagram(active.raw.at(-1) ?? active.origin);
      const from = toDiagram(active.origin);
      apply((current) => {
        let added: ReturnType<typeof addZoneCoverage> = null;
        if (tool === 'zone') {
          if (Math.hypot(end.x - from.x, end.y - from.y) >= MIN_PATH_YARDS) {
            added = addZoneCoverage(current, active.playerId, end);
          }
        } else {
          const target = current.players
            .filter((player) => player.side === 'O')
            .map((player) => ({ player, distance: Math.hypot(player.x - end.x, player.y - end.y) }))
            .filter(({ distance }) => distance <= MAN_SNAP_YARDS)
            .sort((a, b) => a.distance - b.distance)[0];
          if (target) added = addManCoverage(current, active.playerId, target.player.id);
        }
        if (!added) return current;
        addedId = added.assignmentId;
        return added.diagram;
      });
      if (addedId) selectAssignment(addedId);
      else select(active.playerId);
      return;
    }
    // Lo dibujado se pega al origen: da igual dónde empezó el dedo exactamente.
    const start = active.raw[0] ?? active.origin;
    const points = active.raw.map((point) =>
      toDiagram({
        x: active.origin.x + point.x - start.x,
        y: active.origin.y + point.y - start.y,
      }),
    );
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
            {/* En la end zone no hay líneas de yarda ni hash marks. */}
            {yardLines(window)
              .filter((line) => line < goal)
              .map((line) => {
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
              Array.from(
                { length: Math.floor(Math.min(window.maxY, goal) - window.minY) + 1 },
                (_, i) => {
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
                },
              ),
            )}
            <EndZone
              yardLine={diagram.field.yardLine}
              ruleset={ruleset}
              window={window}
              px={px}
              width={width}
              scale={scale}
            />
            <Line
              points={[0, losY, width, losY]}
              stroke={COLORS.firstDown}
              strokeWidth={3}
              dash={[scale, scale * 0.6]}
            />
          </Layer>

          <Layer listening={!drawing && playbackTime === null}>
            {diagram.assignments.filter(isCoverage).map((coverage) => {
              const defender = diagram.players.find((player) => player.id === coverage.playerId);
              if (!defender) return null;
              const target =
                coverage.type === 'man'
                  ? diagram.players.find((player) => player.id === coverage.targetPlayerId)
                  : undefined;
              return (
                <CoverageShape
                  key={coverage.id}
                  coverage={coverage}
                  from={px(positionOf(defender))}
                  to={target ? px(positionOf(target)) : undefined}
                  toScreen={px}
                  toDiagram={toDiagram}
                  scale={scale}
                  selected={coverage.id === selectedAssignmentId}
                  dimmed={playbackTime !== null}
                  onSelect={() => selectAssignment(coverage.id)}
                  onMove={(center) => apply((current) => moveZone(current, coverage.id, center))}
                />
              );
            })}
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
                .filter(
                  (flight) =>
                    flight.action === 'pass' ||
                    flight.action === 'pitch' ||
                    flight.action === 'kick',
                )
                .map((flight) => {
                  const from = px(flight.from);
                  const to = px(flight.to);
                  return (
                    <Group key={`${flight.toPlayerId}-${flight.releaseTime}`} listening={false}>
                      <Line
                        points={[from.x, from.y, to.x, to.y]}
                        stroke={COLORS.pass}
                        strokeWidth={2}
                        dash={flight.action === 'kick' ? [2, 6] : [6, 5]}
                        lineCap="round"
                        opacity={0.9}
                      />
                      <Circle x={to.x} y={to.y} radius={4} fill={COLORS.pass} />
                    </Group>
                  );
                })}
            {draft && coverageTool && (
              <>
                <Line
                  points={[
                    draft.origin.x,
                    draft.origin.y,
                    draft.raw.at(-1)?.x ?? draft.origin.x,
                    draft.raw.at(-1)?.y ?? draft.origin.y,
                  ]}
                  stroke={COLORS.draft}
                  strokeWidth={3}
                  dash={[8, 6]}
                  listening={false}
                />
                {tool === 'zone' && draft.raw.length > 1 && (
                  <Ellipse
                    x={draft.raw.at(-1)?.x ?? 0}
                    y={draft.raw.at(-1)?.y ?? 0}
                    radiusX={5 * scale}
                    radiusY={3.5 * scale}
                    stroke={COLORS.draft}
                    strokeWidth={2}
                    dash={[8, 6]}
                    fill={COLORS.draft}
                    opacity={0.5}
                    listening={false}
                  />
                )}
              </>
            )}
            {draft && !coverageTool && (
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

          {trails && (
            <Layer listening={false}>
              {diagram.players.map((player) => {
                const trail = trails.get(player.id);
                if (!trail) return null;
                return (
                  <Line
                    key={player.id}
                    points={trail.flatMap((point) => {
                      const { x, y } = px(point);
                      return [x, y];
                    })}
                    stroke={player.side === 'O' ? COLORS.offense : COLORS.defense}
                    strokeWidth={Math.max(3, 0.35 * scale)}
                    opacity={0.45}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              })}
            </Layer>
          )}

          <Layer>
            {diagram.players.map((player) => (
              <PlayerNode
                key={player.id}
                player={player}
                position={px(positionOf(player))}
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

interface CoverageShapeProps {
  coverage: CoverageAssignment;
  /** Defensor y, en man, el jugador que cubre (en píxeles, donde estén ahora). */
  from: { x: number; y: number };
  to: { x: number; y: number } | undefined;
  toScreen: (point: Point) => { x: number; y: number };
  toDiagram: (screen: { x: number; y: number }) => Point;
  scale: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  onMove: (center: Point) => void;
}

/**
 * Cobertura de un defensor. Man: línea discontinua hasta su jugador. Zona: la zona
 * sombreada, que se puede arrastrar, con una línea desde el defensor.
 */
function CoverageShape({
  coverage,
  from,
  to,
  toScreen: toPx,
  toDiagram,
  scale,
  selected,
  dimmed,
  onSelect,
  onMove,
}: CoverageShapeProps) {
  const color = selected ? COLORS.selected : COLORS.coverage;
  const select = () => onSelect();
  if (coverage.type === 'man') {
    if (!to) return null;
    return (
      <Group onClick={select} onTap={select} opacity={dimmed ? 0.5 : 0.9}>
        <Line
          points={[from.x, from.y, to.x, to.y]}
          stroke={color}
          strokeWidth={selected ? 3.5 : 2}
          dash={[6, 6]}
          hitStrokeWidth={20}
        />
        <Text
          text="MAN"
          x={(from.x + to.x) / 2 + 4}
          y={(from.y + to.y) / 2 - 14}
          fontSize={Math.max(10, 0.8 * scale)}
          fontStyle="bold"
          fill={color}
          listening={false}
        />
      </Group>
    );
  }
  const center = coverage.points[0];
  if (!center) return null;
  const at = toPx(center);
  return (
    <>
      <Line
        points={[from.x, from.y, at.x, at.y]}
        stroke={color}
        strokeWidth={1.5}
        dash={[4, 6]}
        opacity={dimmed ? 0.35 : 0.7}
        listening={false}
      />
      <Group
        x={at.x}
        y={at.y}
        draggable={!dimmed}
        onClick={select}
        onTap={select}
        onDragStart={select}
        onDragEnd={(event) => {
          const target = snapAndClamp(toDiagram(event.target.position()));
          event.target.position(toPx(target));
          onMove(target);
        }}
      >
        <Ellipse
          radiusX={(coverage.zone.width / 2) * scale}
          radiusY={(coverage.zone.depth / 2) * scale}
          fill={color}
          opacity={dimmed ? 0.12 : 0.2}
          stroke={color}
          strokeWidth={selected ? 3 : 1.5}
          dash={[8, 6]}
        />
        {coverage.zone.name && (
          <Text
            text={coverage.zone.name}
            width={coverage.zone.width * scale}
            offsetX={(coverage.zone.width * scale) / 2}
            offsetY={6}
            align="center"
            fontSize={Math.max(10, 0.8 * scale)}
            fontStyle="bold"
            fill={color}
            opacity={dimmed ? 0.5 : 1}
            listening={false}
          />
        )}
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

/**
 * La end zone rival y los postes, si caben en la ventana: la línea de gol a
 * `100 - yardLine` yardas de la LOS y los postes en la línea de fondo, 10 más allá.
 */
function EndZone({
  yardLine,
  ruleset,
  window,
  px,
  width,
  scale,
}: {
  yardLine: number;
  ruleset: Ruleset;
  window: FieldWindow;
  px: (point: Point) => { x: number; y: number };
  width: number;
  scale: number;
}) {
  const goal = goalLineY(yardLine);
  if (goal >= window.maxY) return null;
  const goalY = px({ x: 0, y: goal }).y;
  const backY = px({ x: 0, y: Math.min(goalPostsY(yardLine), window.maxY) }).y;
  const postsY = goalPostsY(yardLine);
  const half = GOAL_POST_HALF_WIDTH_YARDS[ruleset];
  const left = px({ x: -half, y: postsY });
  const right = px({ x: half, y: postsY });
  return (
    <Group>
      <Rect x={0} y={backY} width={width} height={goalY - backY} fill={COLORS.endZone} />
      <Text
        x={0}
        y={(goalY + backY) / 2 - scale * 1.5}
        width={width}
        align="center"
        text="END ZONE"
        fontSize={scale * 3}
        fontStyle="bold"
        fill={COLORS.chalk}
        opacity={0.18}
        letterSpacing={scale}
      />
      <Line points={[0, goalY, width, goalY]} stroke={COLORS.chalk} strokeWidth={3} opacity={0.7} />
      {postsY <= window.maxY && (
        <>
          <Line
            points={[left.x, left.y, right.x, right.y]}
            stroke={COLORS.firstDown}
            strokeWidth={Math.max(3, scale * 0.4)}
            lineCap="round"
          />
          <Circle
            x={left.x}
            y={left.y}
            radius={Math.max(3, scale * 0.35)}
            fill={COLORS.firstDown}
          />
          <Circle
            x={right.x}
            y={right.y}
            radius={Math.max(3, scale * 0.35)}
            fill={COLORS.firstDown}
          />
        </>
      )}
    </Group>
  );
}
