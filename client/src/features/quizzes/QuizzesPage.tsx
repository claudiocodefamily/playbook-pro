import type { Position } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff, ListChecks, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { TeamNav } from '../../components/TeamNav';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { SelectField, TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { useTeamRole } from '../../hooks/useTeamRole';
import { queries, useCreateQuiz } from '../../lib/api/queries';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { QUIZ_POSITIONS, scoreText } from './quiz-view';

/** Quizzes del equipo. El coach los crea; el jugador ve los publicados y su mejor nota. */
export function QuizzesPage() {
  const { teamId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const quizzes = useQuery(queries.quizzes(teamId));
  const { isCoach } = useTeamRole(teamId);
  const [creating, setCreating] = useState(false);

  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" />
      Nuevo quiz
    </Button>
  );

  return (
    <>
      <PageHeader
        title={team.data?.name ?? 'Equipo'}
        subtitle="Quizzes del equipo"
        back={{ to: '/', label: 'Mis equipos' }}
        actions={isCoach && createButton}
      />
      <TeamNav teamId={teamId} />

      {quizzes.isPending ? (
        <PageSpinner />
      ) : quizzes.isError ? (
        <ErrorAlert message={errorText(quizzes.error)} />
      ) : quizzes.data.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Aún no hay quizzes"
          description={
            isCoach
              ? 'Un quiz pregunta a los jugadores qué hacen en cada jugada: la app lo arma sola a partir de las rutas, bloqueos y zonas que dibujaste.'
              : 'Cuando el coach publique un quiz, aparecerá aquí.'
          }
          action={isCoach && createButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.data.map((quiz) => {
            const best = scoreText(quiz.myBest);
            return (
              <li key={quiz.id}>
                <Link
                  to={`/teams/${teamId}/quizzes/${quiz.id}${isCoach ? '' : '/play'}`}
                  className="flex h-full flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                >
                  <span className="text-xl font-semibold">{quiz.title}</span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-slate-500">
                    {quiz.questionCount} {quiz.questionCount === 1 ? 'pregunta' : 'preguntas'}
                    {isCoach ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs',
                          quiz.visibleToPlayers && 'text-turf-700 dark:text-turf-300',
                        )}
                      >
                        {quiz.visibleToPlayers ? (
                          <Eye aria-hidden className="size-3.5" />
                        ) : (
                          <EyeOff aria-hidden className="size-3.5" />
                        )}
                        {quiz.visibleToPlayers ? 'Publicado' : 'Oculto a jugadores'}
                      </span>
                    ) : best ? (
                      <span className="inline-flex items-center gap-1 text-xs text-turf-700 dark:text-turf-300">
                        <CheckCircle2 aria-hidden className="size-3.5" />
                        Tu mejor nota: {best}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Sin responder
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {isCoach && (
        <CreateQuizModal teamId={teamId} open={creating} onClose={() => setCreating(false)} />
      )}
    </>
  );
}

function CreateQuizModal({
  teamId,
  open,
  onClose,
}: {
  teamId: string;
  open: boolean;
  onClose: () => void;
}) {
  const playbooks = useQuery(queries.playbooks(teamId));
  const create = useCreateQuiz(teamId);
  const navigate = useNavigate();
  const [playbookId, setPlaybookId] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);

  const list = playbooks.data ?? [];
  const playbook = list.find((candidate) => candidate.id === playbookId) ?? list[0];
  const available = playbook ? QUIZ_POSITIONS[playbook.side] : [];
  const chosen = positions.filter((position) => available.includes(position));

  const toggle = (position: Position) =>
    setPositions((current) =>
      current.includes(position)
        ? current.filter((candidate) => candidate !== position)
        : [...current, position],
    );

  const close = () => {
    create.reset();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!playbook) return;
    const form = new FormData(event.currentTarget);
    create.mutate(
      { title: String(form.get('title')).trim(), playbookId: playbook.id, positions: chosen },
      {
        onSuccess: (quiz) => {
          setPositions([]);
          void navigate(`/teams/${teamId}/quizzes/${quiz.id}`);
        },
      },
    );
  };

  return (
    <Modal open={open} title="Nuevo quiz" onClose={close}>
      {playbooks.isSuccess && list.length === 0 ? (
        <p className="text-sm text-slate-600">
          Primero crea un playbook y dibuja sus jugadas: las preguntas salen de ahí.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField
            label="Título"
            name="title"
            required
            maxLength={100}
            autoFocus
            placeholder="Repaso WR: semana 3"
          />
          <SelectField
            label="Playbook"
            value={playbook?.id ?? ''}
            onChange={(event) => setPlaybookId(event.target.value)}
          >
            {list.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </SelectField>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">
              ¿A qué posiciones preguntas?
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {available.map((position) => {
                const selected = chosen.includes(position);
                return (
                  <button
                    key={position}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(position)}
                    className={cn(
                      'min-h-10 min-w-12 rounded-xl px-3 text-sm font-semibold ring-1 transition-colors active:scale-95',
                      selected
                        ? 'bg-turf-700 text-white ring-turf-700'
                        : 'bg-surface text-slate-700 ring-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {position}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Por cada jugador de esas posiciones con una tarea dibujada, la app pregunta qué hace
              en la jugada y da su tarea mezclada con otras parecidas.
            </p>
          </fieldset>
          <ErrorAlert message={errorText(create.error)} />
          <Button
            type="submit"
            size="lg"
            loading={create.isPending}
            disabled={!playbook || chosen.length === 0}
          >
            Crear quiz
          </Button>
        </form>
      )}
    </Modal>
  );
}
