import {
  BrickWall,
  CircleDashed,
  Eraser,
  Hand,
  Link2,
  type LucideIcon,
  MoveHorizontal,
  Pencil,
  Spline,
  Trash2,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { DRAWING_COLORS } from '@playbook/shared';
import { cn } from '../../lib/cn';
import { DRAWING_INK } from '../field/drawings';
import { clearDrawings } from './diagram-ops';
import { useEditor } from './editor-context';
import type { EditorState } from './editor-store';

const TOOLS: readonly {
  id: EditorState['tool'];
  label: string;
  icon: LucideIcon;
  hint: string;
  /** Solo el icono (con su nombre para lectores de pantalla), para que quepan todas. */
  compact?: boolean;
}[] = [
  { id: 'move', label: 'Mover', icon: Hand, hint: 'Arrastra a los jugadores para colocarlos.' },
  {
    id: 'route',
    label: 'Ruta',
    icon: Spline,
    hint: 'Arrastra desde un jugador para dibujar su ruta.',
  },
  {
    id: 'block',
    label: 'Bloqueo',
    icon: BrickWall,
    hint: 'Arrastra desde un jugador hasta donde bloquea. Si lo sueltas sobre un rival, lo sigue a donde vaya.',
  },
  {
    id: 'motion',
    label: 'Motion',
    icon: MoveHorizontal,
    hint: 'Motion: el movimiento antes del snap. Arrastra desde el jugador.',
  },
  {
    id: 'blitz',
    label: 'Blitz',
    icon: Zap,
    hint: 'Blitz: un defensor que ataca al QB. Arrastra desde él.',
  },
  {
    id: 'man',
    label: 'Marcaje',
    icon: Link2,
    hint: 'Marcaje al hombre (man): arrastra desde un defensor hasta el jugador que cubre.',
  },
  {
    id: 'zone',
    label: 'Zona',
    icon: CircleDashed,
    hint: 'Zona: arrastra desde un defensor hasta el centro de la zona que cubre.',
  },
  {
    id: 'pencil',
    label: 'Lápiz',
    icon: Pencil,
    compact: true,
    hint: 'Raya libremente sobre la cancha. Es solo dibujo: no se mueve en la animación.',
  },
  {
    id: 'eraser',
    label: 'Goma',
    icon: Eraser,
    compact: true,
    hint: 'Pasa por encima de un dibujo para borrarlo.',
  },
];

/** Herramientas de la cancha: mover jugadores o dibujar sus trazos. */
export function ToolBar() {
  const tool = useEditor((state) => state.tool);
  const setTool = useEditor((state) => state.setTool);
  const active = TOOLS.find((candidate) => candidate.id === tool) ?? TOOLS[0];
  const pencilColor = useEditor((state) => state.pencilColor);
  const setPencilColor = useEditor((state) => state.setPencilColor);
  const hasDrawings = useEditor((state) => state.diagram.drawings.length > 0);
  const apply = useEditor((state) => state.apply);
  const sketching = tool === 'pencil' || tool === 'eraser';

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="toolbar"
        aria-label="Herramientas de la cancha"
        className="flex gap-1 overflow-x-auto rounded-2xl bg-black/25 p-1"
      >
        {TOOLS.map(({ id, label, icon: Icon, compact }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            onClick={() => setTool(id)}
            className={cn(
              compact && 'flex-none',
              'relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors select-none',
              tool === id ? 'text-turf-900' : 'text-white/85 hover:bg-white/10',
            )}
          >
            {tool === id && (
              <motion.span
                layoutId="editor-tool"
                className="absolute inset-0 rounded-xl bg-white shadow"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Icon aria-hidden className="relative size-4" />
            {!compact && <span className="relative">{label}</span>}
          </button>
        ))}
      </div>
      <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
        <p className="text-xs text-white/75" aria-live="polite">
          {active?.hint}
        </p>
        {sketching && (
          <div className="ml-auto flex items-center gap-2">
            <div role="radiogroup" aria-label="Color del lápiz" className="flex gap-1.5">
              {DRAWING_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={tool === 'pencil' && pencilColor === color}
                  aria-label={DRAWING_INK[color].label}
                  title={DRAWING_INK[color].label}
                  onClick={() => setPencilColor(color)}
                  className={cn(
                    'size-7 rounded-full ring-2 ring-offset-2 ring-offset-turf-900 transition-shadow',
                    tool === 'pencil' && pencilColor === color ? 'ring-white' : 'ring-transparent',
                  )}
                  style={{ backgroundColor: DRAWING_INK[color].hex }}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!hasDrawings}
              onClick={() => apply(clearDrawings)}
              className="flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-white/85 hover:bg-white/10 disabled:opacity-40"
            >
              <Trash2 aria-hidden className="size-3.5" />
              Borrar dibujos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
