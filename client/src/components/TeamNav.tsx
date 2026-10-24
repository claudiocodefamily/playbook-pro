import { BookMarked, BookOpen, ClipboardList, ListChecks, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router';
import { useTeamRole } from '../hooks/useTeamRole';
import { cn } from '../lib/cn';

const TABS = [
  { to: '', label: 'Playbooks', icon: BookOpen, players: true },
  { to: 'roster', label: 'Roster', icon: Users, players: false },
  { to: 'glossary', label: 'Glosario', icon: BookMarked, players: true },
  { to: 'game-plans', label: 'Game plans', icon: ClipboardList, players: true },
  { to: 'quizzes', label: 'Quizzes', icon: ListChecks, players: true },
  { to: 'coaches', label: 'Coaches', icon: ShieldCheck, players: false },
] as const;

/**
 * Pestañas del equipo: playbooks, roster, glosario, game plans, quizzes y coaches. Un
 * jugador no ve el roster ni los coaches.
 */
export function TeamNav({ teamId }: { teamId: string }) {
  const { isPlayer } = useTeamRole(teamId);
  const tabs = TABS.filter((tab) => tab.players || !isPlayer);
  return (
    <nav
      aria-label="Secciones del equipo"
      className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map(({ to, label, icon: Icon }) => (
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
