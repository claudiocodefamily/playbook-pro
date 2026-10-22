import type { Assignment, Point, Ruleset } from '@playbook/shared';
import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '../../lib/cn';
import {
  DEFAULT_WINDOW,
  FIELD_WIDTH,
  type FieldWindow,
  hashMarksX,
  toScreen,
  yardLines,
} from './geometry';
import { pathOrigins } from './paths';

export interface PreviewPlayer extends Point {
  id: string;
  label: string;
  side: 'O' | 'D';
}

interface FieldPreviewProps {
  players: readonly PreviewPlayer[];
  assignments?: readonly Assignment[];
  ruleset?: Ruleset;
  window?: FieldWindow;
  /** Los jugadores aparecen uno tras otro: ayuda a leer la formación al elegirla. */
  animate?: boolean;
  className?: string;
  title?: string;
}

const PLAYER_RADIUS = 0.9;

/** Cancha de solo lectura en SVG: miniaturas de formaciones y vista previa de una jugada. */
export function FieldPreview({
  players,
  assignments = [],
  ruleset = 'college',
  window = DEFAULT_WINDOW,
  animate = false,
  className,
  title,
}: FieldPreviewProps) {
  const markerId = useId();
  const height = window.maxY - window.minY;
  const losY = toScreen({ x: 0, y: 0 }, window).y;
  const playersById = new Map(players.map((player) => [player.id, player]));
  const origins = pathOrigins({ players, assignments });
  const hashes = hashMarksX(ruleset);

  return (
    <svg
      viewBox={`0 0 ${FIELD_WIDTH} ${height}`}
      className={cn('block w-full rounded-2xl bg-turf-700', className)}
      role="img"
      aria-label={title ?? 'Cancha'}
    >
      <defs>
        <marker
          id={`${markerId}-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-chalk)" />
        </marker>
      </defs>

      {yardLines(window).map((line) => {
        const y = toScreen({ x: 0, y: line }, window).y;
        return (
          <line
            key={line}
            x1={0}
            x2={FIELD_WIDTH}
            y1={y}
            y2={y}
            stroke="white"
            strokeOpacity={0.25}
            strokeWidth={0.15}
          />
        );
      })}

      {/* Hash marks: una marca por yarda a cada lado. */}
      {Array.from({ length: Math.floor(height) + 1 }, (_, i) => window.minY + i).map((yard) =>
        hashes.map((hashX) => {
          const { x, y } = toScreen({ x: hashX, y: yard }, window);
          return (
            <line
              key={`${hashX}-${yard}`}
              x1={x - 0.5}
              x2={x + 0.5}
              y1={y}
              y2={y}
              stroke="white"
              strokeOpacity={0.45}
              strokeWidth={0.15}
            />
          );
        }),
      )}

      <line
        x1={0}
        x2={FIELD_WIDTH}
        y1={losY}
        y2={losY}
        stroke="var(--color-first-down)"
        strokeWidth={0.25}
        strokeDasharray="1 0.6"
      />

      {assignments.map((assignment) => {
        const player = playersById.get(assignment.playerId);
        if (!player || assignment.type === 'man') return null;
        if (assignment.type === 'zone') {
          const center = assignment.points[0];
          if (!center) return null;
          const { x, y } = toScreen(center, window);
          return (
            <ellipse
              key={assignment.id}
              cx={x}
              cy={y}
              rx={assignment.zone.width / 2}
              ry={assignment.zone.depth / 2}
              fill="white"
              fillOpacity={0.12}
              stroke="white"
              strokeOpacity={0.5}
              strokeWidth={0.15}
            />
          );
        }
        const path = [origins.get(assignment.id) ?? player, ...assignment.points].map((point) =>
          toScreen(point, window),
        );
        return (
          <polyline
            key={assignment.id}
            points={path.map(({ x, y }) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={assignment.style.color ?? 'var(--color-chalk)'}
            strokeWidth={0.3}
            strokeLinejoin="round"
            strokeDasharray={
              assignment.style.line === 'dashed'
                ? '1 0.6'
                : assignment.style.line === 'dotted'
                  ? '0.2 0.5'
                  : undefined
            }
            markerEnd={assignment.style.end === 'arrow' ? `url(#${markerId}-arrow)` : undefined}
          />
        );
      })}

      {players.map((player, index) => {
        const { x, y } = toScreen(player, window);
        const offense = player.side === 'O';
        return (
          <motion.g
            key={player.id}
            initial={animate ? { opacity: 0, scale: 0.4 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: animate ? index * 0.035 : 0,
              type: 'spring',
              stiffness: 500,
              damping: 28,
            }}
            style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}
          >
            <circle
              cx={x}
              cy={y}
              r={PLAYER_RADIUS}
              fill={offense ? 'white' : 'var(--color-first-down)'}
              stroke={offense ? 'var(--color-turf-900)' : '#713f12'}
              strokeWidth={0.15}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSizeFor(player.label)}
              fontWeight={700}
              fill="#0f172a"
            >
              {player.label}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

/** Etiquetas largas ("Mike") en letra más pequeña para que quepan en el círculo. */
function fontSizeFor(text: string): number {
  return text.length <= 2 ? 0.75 : text.length === 3 ? 0.6 : 0.48;
}
