import { useQuery } from '@tanstack/react-query';
import { Plus, Search, UserCheck, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { TeamNav } from '../../components/TeamNav';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { PageSpinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import type { RosterPlayer } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { PlayerAvatar } from './PlayerAvatar';
import { RosterPlayerModal } from './RosterPlayerModal';

const FILTERS = [
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
  { id: 'all', label: 'Todos' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

/** Normaliza para buscar sin importar tildes ni mayúsculas: "Ramírez" = "ramirez". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function RosterPage() {
  const { teamId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const roster = useQuery(queries.roster(teamId));
  const access = useQuery(queries.playerAccess(teamId));
  const withAccount = new Set(
    (access.data ?? []).filter((entry) => entry.account).map((entry) => entry.rosterPlayerId),
  );
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  // null: cerrado; 'new': jugador nuevo; o el jugador que se edita.
  const [editing, setEditing] = useState<RosterPlayer | 'new' | null>(null);

  const query = normalize(search.trim());
  const visible = (roster.data ?? []).filter(
    (player) =>
      (filter === 'all' || player.active === (filter === 'active')) &&
      (!query ||
        normalize(player.name).includes(query) ||
        String(player.number) === query ||
        player.positions.some((position) => position.toLowerCase() === query)),
  );
  const addButton = (
    <Button onClick={() => setEditing('new')}>
      <Plus aria-hidden className="size-4" />
      Añadir jugador
    </Button>
  );

  return (
    <>
      <PageHeader
        title={team.data?.name ?? 'Equipo'}
        subtitle="Jugadores del equipo"
        back={{ to: '/', label: 'Mis equipos' }}
        actions={addButton}
      />
      <TeamNav teamId={teamId} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" aria-label="Estado" className="flex gap-2">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                'relative min-h-11 rounded-full px-5 text-sm font-semibold transition-colors',
                filter === id
                  ? 'text-white'
                  : 'bg-surface text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
              )}
            >
              {filter === id && (
                <motion.span
                  layoutId="roster-filter"
                  className="absolute inset-0 rounded-full bg-turf-700"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1 sm:max-w-xs">
          <span className="sr-only">Buscar jugador</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, dorsal o posición"
            className="min-h-11 w-full rounded-full border border-slate-300 bg-surface pr-4 pl-10 text-base shadow-sm focus:border-turf-600 focus:ring-2 focus:ring-turf-600/30 focus:outline-none"
          />
        </label>
      </div>

      {roster.isPending ? (
        <PageSpinner />
      ) : roster.isError ? (
        <ErrorAlert message={errorText(roster.error)} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={roster.data.length === 0 ? 'El roster está vacío' : 'Nadie coincide'}
          description={
            roster.data.length === 0
              ? 'Añade a tus jugadores con su dorsal, sus posiciones y una foto. Después podrás ponerlos en las jugadas.'
              : 'Prueba con otro nombre, dorsal o posición, o cambia el filtro.'
          }
          action={roster.data.length === 0 ? addButton : undefined}
        />
      ) : (
        <motion.ul layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((player) => (
              <motion.li
                key={player.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <button
                  type="button"
                  onClick={() => setEditing(player)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-3xl bg-surface p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
                    !player.active && 'opacity-60',
                  )}
                >
                  <PlayerAvatar
                    name={player.name}
                    number={player.number}
                    photoUrl={player.photoUrl}
                    className="size-16 text-2xl"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold">{player.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-turf-700 tabular-nums dark:text-turf-300">
                        #{player.number}
                      </span>
                      {player.positions.map((position) => (
                        <span
                          key={position}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                        >
                          {position}
                        </span>
                      ))}
                      {!player.active && (
                        <span className="text-xs font-medium text-slate-500">Inactivo</span>
                      )}
                      {withAccount.has(player.id) && (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-turf-700 dark:text-turf-300"
                          title="Entra con su propia cuenta"
                        >
                          <UserCheck aria-hidden className="size-3.5" />
                          Con cuenta
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <RosterPlayerModal
        teamId={teamId}
        player={editing === 'new' ? null : editing}
        open={editing !== null}
        takenNumbers={(roster.data ?? [])
          .filter((player) => player.active && player !== editing)
          .map((player) => player.number)}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
