import { Check, CloudOff, LoaderCircle, PencilLine, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/cn';
import type { SaveStatus } from './useAutosave';

const STATUS = {
  saved: {
    icon: Check,
    text: 'Guardado',
    className: 'text-turf-700 bg-turf-50 dark:text-turf-100 dark:bg-turf-900/50',
  },
  pending: {
    icon: PencilLine,
    text: 'Cambios sin guardar',
    className: 'text-slate-600 bg-slate-100',
  },
  saving: { icon: LoaderCircle, text: 'Guardando…', className: 'text-slate-600 bg-slate-100' },
  error: {
    icon: CloudOff,
    text: 'Sin conexión, reintentando',
    className: 'text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/50',
  },
  conflict: {
    icon: TriangleAlert,
    text: 'Otro coach la cambió',
    className: 'text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-950/50',
  },
} as const;

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const { icon: Icon, text, className } = STATUS[status];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        role="status"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium',
          className,
        )}
      >
        <Icon aria-hidden className={cn('size-4', status === 'saving' && 'animate-spin')} />
        {text}
      </motion.span>
    </AnimatePresence>
  );
}
