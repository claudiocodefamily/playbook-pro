import { BookOpen, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router';
import { cn } from '../lib/cn';

const TABS = [
  { to: '', label: 'Playbooks', icon: BookOpen },
  { to: 'roster', label: 'Roster', icon: Users },
  { to: 'coaches', label: 'Coaches', icon: ShieldCheck },
] as const;

/** Pestañas del equipo: sus playbooks, su roster de jugadores y sus coaches. */
export function TeamNav({ teamId }: { teamId: string }) {
  return (
    <nav
      aria-label="Secciones del equipo"
      className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200"
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={label}
          to={`/teams/${teamId}${to ? `/${to}` : ''}`}
          end
          className={({ isActive }) =>
            cn(
              'relative flex min-h-11 shrink-0 items-center gap-2 px-4 text-sm font-semibold transition-colors',
              isActive ? 'text-turf-700 dark:text-turf-300' : 'text-slate-500 hover:text-slate-800',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon aria-hidden className="size-4" />
              {label}
              {isActive && (
                <motion.span
                  layoutId="team-tab"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-turf-600 dark:bg-turf-300"
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
