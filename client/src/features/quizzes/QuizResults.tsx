import { useQuery } from '@tanstack/react-query';
import { TriangleAlert, Users } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorAlert } from '../../components/ui/alert';
import { Spinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { needsReview, rankPlayers, scoreText } from './quiz-view';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/** La nota de cada jugador con cuenta: la mejor, la última y cuántas veces lo intentó. */
export function QuizResultsPanel({
  teamId,
  quizId,
  published,
}: {
  teamId: string;
  quizId: string;
  published: boolean;
}) {
  const results = useQuery(queries.quizResults(teamId, quizId));
  const roster = useQuery(queries.roster(teamId));
  const byRoster = new Map((roster.data ?? []).map((player) => [player.id, player]));

  const players = rankPlayers(
    (results.data?.players ?? []).map((player) => {
      const card = byRoster.get(player.rosterPlayerId);
      return { ...player, name: card?.name ?? player.name, number: card?.number };
    }),
  );
  const done = players.filter((player) => player.attempts > 0).length;

  return (
    <section className="mb-6 flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Resultados</h2>
        {players.length > 0 && (
          <span className="text-sm text-slate-500">
            {done} de {players.length} {players.length === 1 ? 'jugador lo ha' : 'jugadores lo han'}{' '}
            respondido
          </span>
        )}
      </div>
      <ErrorAlert message={errorText(results.error)} />
      {results.isPending ? (
        <Spinner />
      ) : players.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-slate-600">
          <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Ningún jugador tiene cuenta todavía. Invítalos desde su ficha del{' '}
            <Link
              to={`/teams/${teamId}/roster`}
              className="font-semibold text-turf-700 hover:underline dark:text-turf-300"
            >
              roster
            </Link>
            .
          </span>
        </p>
      ) : (
        <>
          {!published && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Está oculto: los jugadores no lo verán hasta que lo publiques.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-slate-200">
            {players.map((player) => (
              <li key={player.userId} className="flex items-center gap-3 py-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold">
                  {player.number ?? '–'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{player.name}</span>
                  <span className="block text-xs text-slate-500">
                    {player.last
                      ? `${player.attempts} ${player.attempts === 1 ? 'intento' : 'intentos'} · último ${dateFormat.format(new Date(player.last.at))}: ${scoreText(player.last)}`
                      : 'Sin responder'}
                  </span>
                </span>
                {player.best && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1 text-sm font-bold',
                      player.best.correct === player.best.total
                        ? 'bg-turf-700 text-white'
                        : 'bg-slate-100 text-slate-800',
                    )}
                    title="Su mejor nota"
                  >
                    {player.best.correct}/{player.best.total}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Cuántos aciertan la pregunta en su último intento. */
export function QuestionStat({
  teamId,
  quizId,
  questionId,
}: {
  teamId: string;
  quizId: string;
  questionId: string;
}) {
  // La misma consulta que el panel: TanStack Query la comparte, no se repite la petición.
  const results = useQuery(queries.quizResults(teamId, quizId));
  const stat = results.data?.questions.find((candidate) => candidate.questionId === questionId);
  if (!stat || stat.answered === 0) return null;
  const review = needsReview(stat);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold',
        review
          ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          : 'bg-turf-50 text-turf-700 dark:bg-turf-900/40 dark:text-turf-300',
      )}
    >
      {review && <TriangleAlert aria-hidden className="size-3.5" />}
      Aciertan {stat.correct} de {stat.answered}
      {review && ': para repasar'}
    </span>
  );
}
