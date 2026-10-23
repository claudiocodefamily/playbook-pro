import { RULESETS, type Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { SelectField, TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { queries, useCreateTeam } from '../../lib/api/queries';
import { errorText } from '../../lib/errors';
import { RULESET_LABELS } from '../../lib/labels';

export function TeamsPage() {
  const teams = useQuery(queries.teams());
  const [creating, setCreating] = useState(false);

  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" />
      Nuevo equipo
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Mis equipos"
        subtitle="Elige el equipo con el que vas a trabajar."
        actions={createButton}
      />

      {teams.isPending ? (
        <PageSpinner />
      ) : teams.isError ? (
        <ErrorAlert message={errorText(teams.error)} />
      ) : teams.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no tienes equipos"
          description="Crea tu equipo para empezar a armar sus playbooks. Después podrás invitar a otros coaches."
          action={createButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.data.map((team, index) => (
            <motion.li
              key={team.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link
                to={`/teams/${team.id}`}
                className="group flex items-center gap-4 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
              >
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-turf-100 text-2xl font-bold text-turf-700 dark:bg-turf-900/60 dark:text-turf-100">
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    team.name.charAt(0)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">{team.name}</span>
                  <span className="text-sm text-slate-500">
                    {RULESET_LABELS[team.ruleset]} · {team.memberCount}{' '}
                    {team.memberCount === 1 ? 'coach' : 'coaches'}
                    {team.myRole === 'PLAYER' && (
                      <span className="ml-2 rounded-full bg-turf-100 px-2 py-0.5 text-xs font-semibold text-turf-800 dark:bg-turf-900/60 dark:text-turf-100">
                        Jugador
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-5 text-slate-400 transition group-hover:translate-x-1"
                />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      <CreateTeamModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function CreateTeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTeam = useCreateTeam();
  const navigate = useNavigate();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createTeam.mutate(
      { name: String(form.get('name')).trim(), ruleset: String(form.get('ruleset')) as Ruleset },
      { onSuccess: (team) => void navigate(`/teams/${team.id}`) },
    );
  };

  return (
    <Modal open={open} title="Nuevo equipo" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label="Nombre del equipo" name="name" required maxLength={80} autoFocus />
        <SelectField
          label="Reglamento"
          name="ruleset"
          defaultValue="college"
          hint="Define dónde se dibujan los hash marks en la cancha."
        >
          {RULESETS.map((ruleset) => (
            <option key={ruleset} value={ruleset}>
              {RULESET_LABELS[ruleset]}
            </option>
          ))}
        </SelectField>
        <ErrorAlert message={errorText(createTeam.error)} />
        <Button type="submit" size="lg" loading={createTeam.isPending}>
          Crear equipo
        </Button>
      </form>
    </Modal>
  );
}
