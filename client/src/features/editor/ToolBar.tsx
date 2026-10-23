import {
  BrickWall,
  CircleDashed,
  Hand,
  Link2,
  type LucideIcon,
  MoveHorizontal,
  Spline,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { useEditor } from './editor-context';
import type { EditorState } from './editor-store';

const TOOLS: readonly {
  id: EditorState['tool'];
  label: string;
  icon: LucideIcon;
  hint: string;
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
];

/** Herramientas de la cancha: mover jugadores o dibujar sus trazos. */
export function ToolBar() {
  const tool = useEditor((state) => state.tool);
  const setTool = useEditor((state) => state.setTool);
  const active = TOOLS.find((candidate) => candidate.id === tool) ?? TOOLS[0];

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="toolbar"
        aria-label="Herramientas de la cancha"
        className="flex gap-1 overflow-x-auto rounded-2xl bg-black/25 p-1"
      >
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
            className={cn(
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
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-white/75" aria-live="polite">
        {active?.hint}
      </p>
    </div>
  );
}
