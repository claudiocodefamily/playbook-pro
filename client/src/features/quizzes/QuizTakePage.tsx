import type { Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, RotateCcw, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { PageSpinner } from '../../components/ui/spinner';
import { queries, useSubmitQuiz } from '../../lib/api/queries';
import type { AttemptResult, Quiz } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { QuizField } from './QuizField';
import {
  type AssignmentQuestionView,
  optionDiagram,
  optionLetter,
  questionWindow,
} from './quiz-view';

type Question = Quiz['questions'][number];

/** Responder un quiz: una pregunta por pantalla y, al enviar, la nota y las correcciones. */
export function QuizTakePage() {
  const { teamId = '', quizId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const quiz = useQuery(queries.quiz(teamId, quizId));
  const submit = useSubmitQuiz(teamId, quizId);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const ruleset = team.data?.ruleset ?? 'high_school';
  const back = { to: `/teams/${teamId}/quizzes`, label: 'Quizzes' };

  if (quiz.isPending) return <PageSpinner />;
  if (quiz.isError) {
    return (
      <>
        <PageHeader title="Quiz" back={back} />
        <ErrorAlert message={errorText(quiz.error)} />
      </>
    );
  }

  const questions = quiz.data.questions;
  const restart = () => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    submit.reset();
  };

  if (result) {
    return (
      <>
        <PageHeader title={quiz.data.title} back={back} />
        <Results
          questions={questions}
          result={result}
          answers={answers}
          ruleset={ruleset}
          onRestart={restart}
        />
      </>
    );
  }

  const question = questions[index];
  if (!question) {
    return (
      <>
        <PageHeader title={quiz.data.title} back={back} />
        <p className="text-slate-600">Este quiz no tiene preguntas.</p>
      </>
    );
  }
  const answered = Object.keys(answers).length;
  const last = index === questions.length - 1;
  const choose = (optionId: string) =>
    setAnswers((current) => ({ ...current, [question.id]: optionId }));

  return (
    <>
      <PageHeader
        title={quiz.data.title}
        subtitle={`Pregunta ${index + 1} de ${questions.length}`}
        back={back}
      />
      <div
        className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Preguntas respondidas"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={answered}
      >
        <motion.div
          className="h-full rounded-full bg-turf-600"
          animate={{ width: `${(answered / questions.length) * 100}%` }}
        />
      </div>

      <motion.section
        key={question.id}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-xl font-semibold">{question.prompt}</h2>
        {question.kind === 'assignment' ? (
          <>
            <p className="text-sm text-slate-600">
              Toca la opción que muestra lo que hace el jugador resaltado.
            </p>
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {question.options.map((option, optionIndex) => (
                <li key={option.id}>
                  <AssignmentOption
                    question={question}
                    optionId={option.id}
                    letter={optionLetter(optionIndex)}
                    ruleset={ruleset}
                    selected={answers[question.id] === option.id}
                    onChoose={() => choose(option.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="flex flex-col gap-2">
            {question.options.map((option, optionIndex) => {
              const selected = answers[question.id] === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => choose(option.id)}
                    className={cn(
                      'flex min-h-13 w-full items-center gap-3 rounded-2xl px-4 text-left font-medium ring-2 transition active:scale-[0.99]',
                      selected
                        ? 'bg-turf-50 ring-turf-600 dark:bg-turf-900/40'
                        : 'bg-surface ring-slate-200 hover:ring-slate-300',
                    )}
                  >
                    <span className="font-bold text-slate-500">{optionLetter(optionIndex)}</span>
                    {option.text}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      <ErrorAlert message={errorText(submit.error)} />
      <div className="mt-6 flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          disabled={index === 0}
          onClick={() => setIndex((current) => current - 1)}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Anterior
        </Button>
        {last ? (
          <Button
            size="lg"
            loading={submit.isPending}
            onClick={() =>
              submit.mutate(
                Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
                { onSuccess: setResult },
              )
            }
          >
            <Send aria-hidden className="size-4" />
            {answered < questions.length
              ? `Enviar (${questions.length - answered} sin responder)`
              : 'Enviar respuestas'}
          </Button>
        ) : (
          <Button
            size="lg"
            disabled={!answers[question.id]}
            onClick={() => setIndex((current) => current + 1)}
          >
            Siguiente
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        )}
      </div>
    </>
  );
}

function AssignmentOption({
  question,
  optionId,
  letter,
  ruleset,
  selected,
  onChoose,
}: {
  question: AssignmentQuestionView;
  optionId: string;
  letter: string;
  ruleset: Ruleset;
  selected: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Opción ${letter}`}
      onClick={onChoose}
      className={cn(
        'relative block w-full overflow-hidden rounded-2xl bg-turf-900 p-1 ring-4 transition active:scale-[0.98]',
        selected ? 'ring-sky-400' : 'ring-transparent hover:ring-white/30',
      )}
    >
      {/* La cancha no recibe toques: el botón entero elige la opción. */}
      <div className="pointer-events-none">
        <QuizField
          diagram={optionDiagram(question, optionId)}
          ruleset={ruleset}
          playerId={question.playerId}
          window={questionWindow(question)}
        />
      </div>
      <span
        className={cn(
          'absolute right-2 bottom-2 rounded-full px-2.5 py-0.5 text-sm font-bold',
          selected ? 'bg-sky-400 text-sky-950' : 'bg-black/60 text-white',
        )}
      >
        {letter}
      </span>
    </button>
  );
}

function Results({
  questions,
  result,
  answers,
  ruleset,
  onRestart,
}: {
  questions: Question[];
  result: AttemptResult;
  answers: Record<string, string>;
  ruleset: Ruleset;
  onRestart: () => void;
}) {
  const { teamId = '' } = useParams();
  const byId = new Map(result.results.map((entry) => [entry.questionId, entry]));
  const perfect = result.correct === result.total;
  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-2 rounded-3xl bg-turf-900 px-6 py-8 text-center text-white"
      >
        <p className="text-sm font-semibold tracking-wide text-white/70 uppercase">Tu nota</p>
        <p className="text-5xl font-bold">
          {result.correct} <span className="text-white/60">de</span> {result.total}
        </p>
        <p className="text-white/80">
          {perfect
            ? '¡Perfecto! Te sabes las jugadas.'
            : 'Repasa las que fallaste y vuelve a intentarlo.'}
        </p>
        <Button variant="secondary" className="mt-2" onClick={onRestart}>
          <RotateCcw aria-hidden className="size-4" />
          Repetir
        </Button>
      </motion.div>

      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => {
          const entry = byId.get(question.id);
          const correct = entry?.isCorrect ?? false;
          const correctOptionId = entry?.correctOptionId ?? '';
          const chosen = answers[question.id];
          return (
            <li
              key={question.id}
              className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-slate-200"
            >
              <h3 className="flex items-start gap-2 font-semibold">
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full text-white',
                    correct ? 'bg-turf-600' : 'bg-red-600',
                  )}
                >
                  {correct ? (
                    <Check aria-label="Acertada" className="size-4" />
                  ) : (
                    <X aria-label="Fallada" className="size-4" />
                  )}
                </span>
                <span>
                  {index + 1}. {question.prompt}
                </span>
              </h3>
              {question.kind === 'assignment' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {!correct && chosen && (
                    <ReviewField
                      label="Tu respuesta"
                      tone="wrong"
                      question={question}
                      optionId={chosen}
                      ruleset={ruleset}
                    />
                  )}
                  <ReviewField
                    label={correct ? 'Tu respuesta' : 'La correcta'}
                    tone="right"
                    question={question}
                    optionId={correctOptionId}
                    ruleset={ruleset}
                  />
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {question.options.map((option) => (
                    <li
                      key={option.id}
                      className={cn(
                        'rounded-xl px-3 py-2 ring-1',
                        option.id === correctOptionId
                          ? 'bg-turf-50 font-semibold ring-turf-600/40 dark:bg-turf-900/40'
                          : option.id === chosen
                            ? 'bg-red-50 ring-red-300 line-through dark:bg-red-950/40'
                            : 'ring-slate-200 text-slate-500',
                      )}
                    >
                      {option.text}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <Link
        to={`/teams/${teamId}/quizzes`}
        className="self-center text-sm font-semibold text-turf-700 hover:underline dark:text-turf-300"
      >
        Volver a los quizzes
      </Link>
    </div>
  );
}

function ReviewField({
  label,
  tone,
  question,
  optionId,
  ruleset,
}: {
  label: string;
  tone: 'right' | 'wrong';
  question: AssignmentQuestionView;
  optionId: string;
  ruleset: Ruleset;
}) {
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-2xl bg-turf-900 p-1 ring-2',
        tone === 'right' ? 'ring-turf-300' : 'ring-red-500',
      )}
    >
      <QuizField
        diagram={optionDiagram(question, optionId)}
        ruleset={ruleset}
        playerId={question.playerId}
        window={questionWindow(question)}
      />
      <figcaption className="px-2 py-1 text-xs font-semibold text-white">{label}</figcaption>
    </figure>
  );
}
