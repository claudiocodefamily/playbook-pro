import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Eye, EyeOff, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { TeamNav } from '../../components/TeamNav';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { useTeamRole } from '../../hooks/useTeamRole';
import { queries, useCreateGamePlan } from '../../lib/api/queries';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { formatGameDate } from './situations';

/** Game plans del equipo: uno por partido, con sus jugadas por situación. */
export function GamePlansPage() {
  const { teamId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const plans = useQuery(queries.gamePlans(teamId));
  const { isCoach } = useTeamRole(teamId);
  const [creating, setCreating] = useState(false);

  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" />
      Nuevo game plan
    </Button>
  );

  return (
    <>
      <PageHeader
        title={team.data?.name ?? 'Equipo'}
        subtitle="Game plans"
        back={{ to: '/', label: 'Mis equipos' }}
        actions={isCoach && createButton}
      />
      <TeamNav teamId={teamId} />

      {plans.isPending ? (
        <PageSpinner />
      ) : plans.isError ? (
        <ErrorAlert message={errorText(plans.error)} />
      ) : plans.data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aún no hay game plans"
          description={
            isCoach
              ? 'Un game plan reúne las jugadas para un partido, ordenadas por situación: 3rd down, red zone, 2 minutos…'
              : 'Cuando el coach publique el plan de un partido, aparecerá aquí.'
          }
          action={isCoach && createButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.data.map((plan) => (
            <li key={plan.id}>
              <Link
                to={`/teams/${teamId}/game-plans/${plan.id}`}
                className="flex h-full flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
              >
                <span className="text-xl font-semibold">vs {plan.opponent}</span>
                <span className="flex items-center gap-1.5 text-sm text-slate-600">
                  <CalendarDays aria-hidden className="size-4" />
                  {formatGameDate(plan.gameDate) ?? 'Sin fecha'}
                </span>
                <span className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-slate-500">
                  {plan.playCount} {plan.playCount === 1 ? 'jugada' : 'jugadas'}
                  {isCoach && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs',
                        plan.visibleToPlayers && 'text-turf-700 dark:text-turf-300',
                      )}
                    >
                      {plan.visibleToPlayers ? (
                        <Eye aria-hidden className="size-3.5" />
                      ) : (
                        <EyeOff aria-hidden className="size-3.5" />
                      )}
                      {plan.visibleToPlayers ? 'Publicado' : 'Oculto a jugadores'}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isCoach && (
        <CreateGamePlanModal teamId={teamId} open={creating} onClose={() => setCreating(false)} />
      )}
    </>
  );
}

function CreateGamePlanModal({
  teamId,
  open,
  onClose,
}: {
  teamId: string;
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateGamePlan(teamId);
  const navigate = useNavigate();

  const close = () => {
    create.reset();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const gameDate = String(form.get('gameDate'));
    create.mutate(
      { opponent: String(form.get('opponent')).trim(), gameDate: gameDate || null },
      { onSuccess: (plan) => void navigate(`/teams/${teamId}/game-plans/${plan.id}`) },
    );
  };

  return (
    <Modal open={open} title="Nuevo game plan" onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Rival"
          name="opponent"
          required
          maxLength={80}
          autoFocus
          placeholder="Halcones"
        />
        <TextField label="Día del partido (opcional)" name="gameDate" type="date" />
        <p className="text-xs text-slate-500">
          Empieza con las situaciones típicas (1st & 10, 3rd down, red zone, 2 minutos…). Puedes
          renombrarlas, quitarlas o añadir otras.
        </p>
        <ErrorAlert message={errorText(create.error)} />
        <Button type="submit" size="lg" loading={create.isPending}>
          Crear game plan
        </Button>
      </form>
    </Modal>
  );
}
