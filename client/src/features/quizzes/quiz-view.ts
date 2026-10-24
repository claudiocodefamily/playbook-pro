import type { PlayDiagram, PlaybookSide, Position, QuizQuestionView } from '@playbook/shared';
import { type FieldWindow, viewWindow } from '../field/geometry';

export type AssignmentQuestionView = Extract<QuizQuestionView, { kind: 'assignment' }>;

/** Letra de cada opción: A, B, C, D. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** La jugada con la tarea de una opción puesta en el jugador por el que se pregunta. */
export function optionDiagram(question: AssignmentQuestionView, optionId: string): PlayDiagram {
  const option = question.options.find((candidate) => candidate.id === optionId);
  return {
    ...question.diagram,
    assignments: [...question.diagram.assignments, ...(option?.assignments ?? [])],
  };
}

/** Un mismo encuadre para todas las opciones, para compararlas sin que salte la cancha. */
export function questionWindow(question: AssignmentQuestionView): FieldWindow {
  return viewWindow({
    ...question.diagram,
    assignments: [
      ...question.diagram.assignments,
      ...question.options.flatMap((option) => option.assignments),
    ],
  });
}

/** Posiciones que tiene sentido preguntar según la unidad del playbook. */
export const QUIZ_POSITIONS: Readonly<Record<PlaybookSide, readonly Position[]>> = {
  offense: ['QB', 'RB', 'WR', 'TE', 'OL'],
  defense: ['DL', 'LB', 'CB', 'S'],
  special: ['K', 'P', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'],
};

/** "3 de 4" o, si no lo ha respondido nunca, null. */
export function scoreText(score: { correct: number; total: number } | null): string | null {
  return score ? `${score.correct} de ${score.total}` : null;
}

/** Jugadores ordenados por su mejor nota (en proporción); los que no respondieron, al final. */
export function rankPlayers<
  T extends { name: string; best: { correct: number; total: number } | null },
>(players: readonly T[]): T[] {
  const ratio = (player: T) =>
    player.best && player.best.total > 0 ? player.best.correct / player.best.total : -1;
  return [...players].sort((a, b) => ratio(b) - ratio(a) || a.name.localeCompare(b.name));
}

/** true si menos de la mitad acierta la pregunta: hay que repasarla. */
export function needsReview(stat: { answered: number; correct: number }): boolean {
  return stat.answered > 0 && stat.correct / stat.answered < 0.5;
}
