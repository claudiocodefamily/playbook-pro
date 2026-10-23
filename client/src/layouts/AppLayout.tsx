import { LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, Outlet, useLocation } from 'react-router';
import { useAuth, useCurrentUser } from '../auth/auth-context';
import { ThemeToggle } from '../components/ThemeToggle';
import { Button } from '../components/ui/button';

/** Cabecera común y transición suave al cambiar de página. */
export function AppLayout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 bg-turf-800 text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-white/15">
              🏈
            </span>
            PlayBook Pro
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-white/80 sm:inline">{user.name}</span>
            <ThemeToggle className="text-white hover:bg-white/15" />
            <Button
              variant="ghost"
              className="text-white hover:bg-white/15"
              onClick={() => void logout()}
            >
              <LogOut aria-hidden className="size-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
