import { RULESETS, type Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { Trash2, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { useParams } from 'react-router';
import { useCurrentUser } from '../../auth/auth-context';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { TeamNav } from '../../components/TeamNav';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { SelectField, TextField } from '../../components/ui/field';
import { PageSpinner } from '../../components/ui/spinner';
import { queries, useAddMember, useRemoveMember, useUpdateTeam } from '../../lib/api/queries';
import type { Team, TeamMember } from '../../lib/api/types';
import { errorText } from '../../lib/errors';
import { RULESET_LABELS } from '../../lib/labels';

const DATE = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });

/** Coaches del equipo (todos con los mismos permisos) y datos del equipo. */
export function CoachesPage() {
  const { teamId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const members = useQuery(queries.members(teamId));
  const user = useCurrentUser();
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const removeMember = useRemoveMember(teamId);
  const onlyOne = (members.data?.length ?? 0) <= 1;

  return (
    <>
      <PageHeader
        title={team.data?.name ?? 'Equipo'}
        subtitle="Coaches y datos del equipo"
        back={{ to: '/', label: 'Mis equipos' }}
      />
      <TeamNav teamId={teamId} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 ring-1 ring-slate-200">
          <div>
            <h2 className="text-lg font-semibold">Coaches</h2>
            <p className="text-sm text-slate-600">
              Todos pueden crear y editar playbooks, jugadas y el roster.
            </p>
          </div>
          {members.isPending ? (
            <PageSpinner />
          ) : members.isError ? (
            <ErrorAlert message={errorText(members.error)} />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-200">
              <AnimatePresence initial={false}>
                {members.data.map((member) => (
                  <motion.li
                    key={member.userId}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-turf-100 font-bold text-turf-700 dark:bg-turf-900/60 dark:text-turf-100">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {member.name}
                        {member.userId === user.id && (
                          <span className="ml-2 text-xs font-medium text-slate-500">(tú)</span>
                        )}
                      </span>
                      <span className="block truncate text-sm text-slate-500">
                        {member.email} · desde {DATE.format(new Date(member.joinedAt))}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-600"
                      disabled={onlyOne}
                      title={onlyOne ? 'El equipo necesita al menos un coach' : undefined}
                      aria-label={`Quitar a ${member.name}`}
                      onClick={() => setRemoving(member)}
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </Button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          <AddCoachForm teamId={teamId} />
        </section>

        {team.data && <TeamSettings key={team.data.updatedAt} team={team.data} />}
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={removing?.userId === user.id ? '¿Salir del equipo?' : '¿Quitar al coach?'}
        message={
          removing?.userId === user.id
            ? 'Dejarás de ver los playbooks y el roster de este equipo.'
            : `${removing?.name ?? ''} dejará de ver los playbooks y el roster del equipo.`
        }
        confirmLabel={removing?.userId === user.id ? 'Salir' : 'Quitar'}
        pending={removeMember.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          removeMember.mutate(removing.userId, {
            onSuccess: () => {
              setRemoving(null);
              if (removing.userId === user.id) window.location.assign('/');
            },
          })
        }
      />
    </>
  );
}

function AddCoachForm({ teamId }: { teamId: string }) {
  const addMember = useAddMember(teamId);
  const [email, setEmail] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addMember.mutate(email.trim(), { onSuccess: () => setEmail('') });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-slate-200 pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          label="Añadir coach por email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="coordinador@equipo.com"
          className="flex-1"
        />
        <Button type="submit" loading={addMember.isPending}>
          <UserPlus aria-hidden className="size-4" />
          Añadir
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Tiene que haberse registrado antes en PlayBook Pro con ese email.
      </p>
      <ErrorAlert message={errorText(addMember.error)} />
    </form>
  );
}

function TeamSettings({ team }: { team: Team }) {
  const update = useUpdateTeam(team.id);
  const [name, setName] = useState(team.name);
  const [ruleset, setRuleset] = useState<Ruleset>(team.ruleset);
  const changed = name.trim() !== team.name || ruleset !== team.ruleset;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate({ name: name.trim(), ruleset });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 self-start rounded-3xl bg-surface p-5 ring-1 ring-slate-200"
    >
      <h2 className="text-lg font-semibold">Equipo</h2>
      <TextField
        label="Nombre"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        maxLength={80}
      />
      <SelectField
        label="Reglamento"
        value={ruleset}
        onChange={(event) => setRuleset(event.target.value as Ruleset)}
        hint="Cambia dónde se dibujan los hash marks y los postes."
      >
        {RULESETS.map((option) => (
          <option key={option} value={option}>
            {RULESET_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <ErrorAlert message={errorText(update.error)} />
      <Button type="submit" disabled={!changed} loading={update.isPending}>
        Guardar cambios
      </Button>
    </form>
  );
}
