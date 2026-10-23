import { Monitor, Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/cn';
import { THEMES, type Theme, useTheme } from '../lib/theme';
import { Button } from './ui/button';

const OPTIONS: Readonly<Record<Theme, { icon: typeof Sun; label: string }>> = {
  system: { icon: Monitor, label: 'Tema del sistema' },
  light: { icon: Sun, label: 'Tema claro' },
  dark: { icon: Moon, label: 'Tema oscuro' },
};

/** Botón que pasa de tema del sistema a claro y a oscuro. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system';
  const { icon: Icon, label } = OPTIONS[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('overflow-hidden', className)}
      onClick={() => setTheme(next)}
      aria-label={`${label}. Cambiar a ${OPTIONS[next].label.toLowerCase()}`}
      title={label}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Icon aria-hidden className="size-5" />
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
