import type { Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Play, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { useTeamRole } from '../../hooks/useTeamRole';
import {
  queries,
  useAddQuizQuestion,
  useDeleteQuiz,
  useRemoveQuizQuestion,
  useUpdateQuiz,
} from '../../lib/api/queries';
import type { Quiz } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { QuizField } from './QuizField';
import { optionDiagram, optionLetter, questionWindow } from './quiz-view';

/** El quiz visto por el coach: sus preguntas con la respuesta, para revisarlo y publicarlo. */
export function QuizPage() {
  const { teamId = '', quizId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const quiz = useQuery(queries.quiz(teamId, quizId));
  const { isPlayer } = useTeamRole(teamId);
  const update = useUpdateQuiz(teamId, quizId);
  const removeQuestion = useRemoveQuizQuestion(teamId, quizId);
  const deleteQuiz = useDeleteQuiz(teamId);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Un jugador va directo a responderlo.
  if (isPlayer) return <Navigate to={`/teams/${teamId}/quizzes/${quizId}/play`} replace />;

  const published = quiz.data?.visibleToPlayers ?? false;
  const questions = quiz.data?.questions ?? [];

  return (
    <>
      <PageHeader
        title={quiz.data?.title ?? 'Quiz'}
        subtitle={
          quiz.data &&
          `${quiz.data.questionCount} ${quiz.data.questionCount === 1 ? 'pregunta' : 'preguntas'}`
        }
        back={{ to: `/teams/${teamId}/quizzes`, label: 'Quizzes' }}
        actions={
          <>
            <Button
              variant="secondary"
              aria-pressed={published}
              disabled={!quiz.data}
              loading={update.isPending}
              title="Los jugadores con cuenta solo ven los quizzes publicados"
              onClick={() => update.mutate({ visibleToPlayers: !published })}
            >
              {published ? (
                <Eye aria-hidden className="size-4" />
              ) : (
                <EyeOff aria-hidden className="size-4" />
              )}
              {published ? 'Publicado' : 'Oculto a jugadores'}
            </Button>
            <Link
              to={`/teams/${teamId}/quizzes/${quizId}/play`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-turf-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-turf-800"
            >
              <Play aria-hidden className="size-4" />
              Probar
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Borrar el quiz"
              className="text-slate-400 hover:text-red-600"
              onClick={() => setDeleting(true)}
            >
              <Trash2 aria-hidden className="size-5" />
            </Button>
          </>
        }
      />

      <ErrorAlert message={errorText(update.error ?? removeQuestion.error)} />
      {quiz.isPending ? (
        <PageSpinner />
      ) : quiz.isError ? (
        <ErrorAlert message={errorText(quiz.error)} />
      ) : (
        <>
          <ol className="flex flex-col gap-4">
            {questions.map((question, index) => (
              <li
                key={question.id}
                className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">
                    <span className="text-slate-500">{index + 1}.</span> {question.prompt}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar la pregunta ${index + 1}`}
                    className="shrink-0 text-slate-400 hover:text-red-600"
                    loading={removeQuestion.isPending && removeQuestion.variables === question.id}
                    onClick={() => removeQuestion.mutate(question.id)}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
                {question.kind === 'assignment' ? (
                  <AssignmentAnswers
                    question={question}
                    ruleset={team.data?.ruleset ?? 'high_school'}
                  />
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {question.options.map((option, optionIndex) => {
                      const correct = option.id === question.correctOptionId;
                      return (
                        <li
                          key={option.id}
                          className={cn(
                            'flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1',
                            correct
                              ? 'bg-turf-50 font-semibold ring-turf-600/40 dark:bg-turf-900/40'
                              : 'ring-slate-200',
                          )}
                        >
                          <span className="font-bold text-slate-500">
                            {optionLetter(optionIndex)}
                          </span>
                          {option.text}
                          {correct && (
                            <Check
                              aria-label="Correcta"
                              className="ml-auto size-4 text-turf-700 dark:text-turf-300"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <Button variant="secondary" className="mt-4 self-start" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Añadir pregunta escrita
          </Button>
        </>
      )}

      {quiz.data && (
        <TextQuestionModal
          teamId={teamId}
          quiz={quiz.data}
          open={adding}
          onClose={() => setAdding(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title="¿Borrar el quiz?"
        message={`Se borrarán «${quiz.data?.title ?? ''}» y las respuestas de los jugadores.`}
        confirmLabel="Borrar"
        pending={deleteQuiz.isPending}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          deleteQuiz.mutate(quizId, {
            onSuccess: () => void navigate(`/teams/${teamId}/quizzes`, { replace: true }),
          })
        }
      />
    </>
  );
}

/** Las opciones dibujadas de una pregunta, con la correcta marcada. */
function AssignmentAnswers({
  question,
  ruleset,
}: {
  question: Extract<Quiz['questions'][number], { kind: 'assignment' }>;
  ruleset: Ruleset;
}) {
  const window = questionWindow(question);
  return (
    <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {question.options.map((option, index) => {
        const correct = option.id === question.correctOptionId;
        return (
          <li
            key={option.id}
            className={cn(
              'relative overflow-hidden rounded-2xl bg-turf-900 p-1 ring-2',
              correct ? 'ring-amber-400' : 'ring-transparent',
            )}
          >
            <QuizField
              diagram={optionDiagram(question, option.id)}
              ruleset={ruleset}
              playerId={question.playerId}
              window={window}
            />
            <span
              className={cn(
                'absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs font-bold',
                correct ? 'bg-amber-400 text-amber-950' : 'bg-black/50 text-white',
              )}
            >
              {optionLetter(index)}
              {correct && ' · Correcta'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function TextQuestionModal({
  teamId,
  quiz,
  open,
  onClose,
}: {
  teamId: string;
  quiz: Quiz;
  open: boolean;
  onClose: () => void;
}) {
  const add = useAddQuizQuestion(teamId, quiz.id);
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);

  const reset = () => {
    setPrompt('');
    setOptions(['', '']);
    setCorrectIndex(0);
    add.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(
      { prompt: prompt.trim(), options: options.map((option) => option.trim()), correctIndex },
      { onSuccess: close },
    );
  };

  return (
    <Modal open={open} title="Pregunta escrita" onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Pregunta"
          required
          maxLength={300}
          autoFocus
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="¿Qué hace el X si le juegan press?"
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-slate-700">
            Respuestas (marca la correcta)
          </legend>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                aria-label={`La respuesta ${optionLetter(index)} es la correcta`}
                checked={correctIndex === index}
                onChange={() => setCorrectIndex(index)}
                className="size-5 accent-turf-700"
              />
              <input
                required
                maxLength={150}
                aria-label={`Respuesta ${optionLetter(index)}`}
                value={option}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
                className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-surface px-3 text-base"
              />
              {options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar la respuesta ${optionLetter(index)}`}
                  onClick={() => {
                    setOptions((current) => current.filter((_, i) => i !== index));
                    setCorrectIndex((current) =>
                      current === index ? 0 : current > index ? current - 1 : current,
                    );
                  }}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 4 && (
            <Button
              variant="ghost"
              className="self-start"
              onClick={() => setOptions((current) => [...current, ''])}
            >
              <Plus aria-hidden className="size-4" />
              Otra respuesta
            </Button>
          )}
        </fieldset>
        <ErrorAlert message={errorText(add.error)} />
        <Button type="submit" size="lg" loading={add.isPending}>
          Añadir
        </Button>
      </form>
    </Modal>
  );
}
