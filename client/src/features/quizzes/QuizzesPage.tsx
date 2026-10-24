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
import { plannedQuestions, positionChoices, scoreText } from './quiz-view';

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
  const coverage = useQuery({
    ...queries.quizCoverage(teamId, playbook?.id ?? ''),
    enabled: open && Boolean(playbook),
  });
  const choices = playbook ? positionChoices(playbook.side, coverage.data?.positions) : [];
  // Solo cuentan las que dan preguntas (o todas, si el recuento no llegó).
  const chosen = positions.filter((position) =>
    choices.some((choice) => choice.position === position && choice.questions !== 0),
  );
  const planned = plannedQuestions(choices, chosen);
  const nothingDrawn = coverage.isSuccess && coverage.data.positions.length === 0;

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
              {choices.map(({ position, questions }) => {
                const selected = chosen.includes(position);
                const empty = questions === 0;
                return (
                  <button
                    key={position}
                    type="button"
                    aria-pressed={selected}
                    disabled={empty}
                    title={empty ? `Ningún ${position} tiene tareas dibujadas` : undefined}
                    onClick={() => toggle(position)}
                    className={cn(
                      'inline-flex min-h-10 min-w-12 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 transition-colors active:scale-95',
                      selected
                        ? 'bg-turf-700 text-white ring-turf-700'
                        : 'bg-surface text-slate-700 ring-slate-300 hover:bg-slate-50',
                      empty && 'cursor-not-allowed text-slate-400 opacity-60 hover:bg-surface',
                    )}
                  >
                    {position}
                    {questions !== null && questions > 0 && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-xs',
                          selected ? 'bg-white/20' : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {questions}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {nothingDrawn ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                Este playbook aún no tiene tareas dibujadas. Abre una jugada y dibuja a los
                jugadores una <strong>Ruta</strong>, <strong>Bloqueo</strong>,{' '}
                <strong>Blitz</strong> o <strong>Zona</strong>: las preguntas salen de ahí.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                El número es cuántas preguntas salen. Por cada jugador con una ruta, bloqueo,
                motion, blitz o zona dibujada, la app pregunta qué hace en la jugada. El lápiz y el
                marcaje (man) no cuentan.
              </p>
            )}
          </fieldset>
          <ErrorAlert message={errorText(create.error)} />
          <Button
            type="submit"
            size="lg"
            loading={create.isPending}
            disabled={!playbook || chosen.length === 0}
          >
            {planned > 0
              ? `Crear quiz · ${planned} ${planned === 1 ? 'pregunta' : 'preguntas'}`
              : 'Crear quiz'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
