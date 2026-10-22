import type { DiagramPlayer, Ruleset } from '@playbook/shared';
import Konva from 'konva';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import {
  FIELD_WIDTH,
  type FieldWindow,
  fromScreen,
  hashMarksX,
  toScreen,
  yardLines,
} from '../field/geometry';
import { movePlayer, snapAndClamp } from './diagram-ops';
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
};

interface FieldCanvasProps {
  ruleset: Ruleset;
  window: FieldWindow;
}

/** La cancha interactiva: arrastra jugadores con el dedo o el ratón. */
export function FieldCanvas({ ruleset, window }: FieldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);
  const diagram = useEditor((state) => state.diagram);
  const selectedId = useEditor((state) => state.selectedId);
  const select = useEditor((state) => state.select);

  const scale = width / FIELD_WIDTH; // px por yarda
  const height = (window.maxY - window.minY) * scale;
  const px = (point: { x: number; y: number }) => {
    const screen = toScreen(point, window);
    return { x: screen.x * scale, y: screen.y * scale };
  };
  const playersById = new Map(diagram.players.map((player) => [player.id, player]));
  const losY = px({ x: 0, y: 0 }).y;

  return (
    <div ref={containerRef} className="w-full touch-none overflow-hidden rounded-2xl bg-turf-700">
      {width > 0 && (
        <Stage
          width={width}
          height={height}
          onClick={(event) => event.target === event.target.getStage() && select(null)}
          onTap={(event) => event.target === event.target.getStage() && select(null)}
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

          <Layer listening={false}>
            {diagram.assignments.map((assignment) => {
              const player = playersById.get(assignment.playerId);
              if (!player || assignment.type === 'man' || assignment.type === 'zone') return null;
              const points = [player, ...assignment.points].flatMap((point) => {
                const { x, y } = px(point);
                return [x, y];
              });
              const dash =
                assignment.style.line === 'dashed'
                  ? [scale, scale * 0.6]
                  : assignment.style.line === 'dotted'
                    ? [2, scale * 0.5]
                    : undefined;
              return assignment.style.end === 'arrow' ? (
                <Arrow
                  key={assignment.id}
                  points={points}
                  stroke={COLORS.chalk}
                  fill={COLORS.chalk}
                  strokeWidth={3}
                  pointerLength={10}
                  pointerWidth={10}
                  tension={assignment.style.curved ? 0.4 : 0}
                  dash={dash}
                  lineJoin="round"
                />
              ) : (
                <Line
                  key={assignment.id}
                  points={points}
                  stroke={COLORS.chalk}
                  strokeWidth={3}
                  tension={assignment.style.curved ? 0.4 : 0}
                  dash={dash}
                  lineJoin="round"
                />
              );
            })}
          </Layer>

          <Layer>
            {diagram.players.map((player) => (
              <PlayerNode
                key={player.id}
                player={player}
                position={px(player)}
                radius={Math.max(PLAYER_RADIUS * scale, MIN_RADIUS)}
                selected={player.id === selectedId}
                toDiagram={(screen) =>
                  fromScreen({ x: screen.x / scale, y: screen.y / scale }, window)
                }
                toScreen={px}
                bounds={{ width, height }}
              />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  );
}

interface PlayerNodeProps {
  player: DiagramPlayer;
  position: { x: number; y: number };
  radius: number;
  selected: boolean;
  toDiagram: (screen: { x: number; y: number }) => { x: number; y: number };
  toScreen: (point: { x: number; y: number }) => { x: number; y: number };
  bounds: { width: number; height: number };
}

/**
 * Un jugador. La posición no se pasa como prop controlada: cuando cambia (otra formación,
 * deshacer...), el jugador se desliza hasta su sitio nuevo en vez de saltar.
 */
function PlayerNode({
  player,
  position,
  radius,
  selected,
  toDiagram,
  toScreen: toPx,
  bounds,
}: PlayerNodeProps) {
  const ref = useRef<Konva.Group>(null);
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
    node.to({ x, y, duration: 0.35, easing: Konva.Easings.EaseInOut });
  }, [x, y]);

  const offense = player.side === 'O';
  const fontSize =
    radius * (player.label.length <= 2 ? 0.85 : player.label.length === 3 ? 0.7 : 0.55);

  return (
    <Group
      ref={ref}
      draggable
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
      onClick={() => select(player.id)}
      onTap={() => select(player.id)}
      onMouseEnter={(event) => {
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = 'grab';
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
