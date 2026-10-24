import { createEmptyDiagram, newId } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import {
  needsReview,
  optionDiagram,
  optionLetter,
  plannedQuestions,
  positionChoices,
  questionWindow,
  rankPlayers,
  scoreText,
  type AssignmentQuestionView,
} from './quiz-view';

function question(): AssignmentQuestionView {
  const x = { id: newId(), side: 'O', position: 'WR', label: 'X', x: -20, y: 0 } as const;
  const route = (y: number) => ({
    id: newId(),
    playerId: x.id,
    type: 'route' as const,
    points: [{ x: -20, y }],
    style: { line: 'solid' as const, end: 'arrow' as const, curved: false },
    startTime: 0,
    endTime: 2,
  });
  return {
    id: newId(),
    kind: 'assignment',
    prompt: '¿Qué hace X?',
    playId: newId(),
    playName: 'Go',
    playerId: x.id,
    diagram: { ...createEmptyDiagram(), players: [x] },
    options: [
      { id: newId(), assignments: [route(5)] },
      { id: newId(), assignments: [route(40)] },
    ],
  };
}

describe('quiz-view', () => {
  it('pone la tarea de la opción en la jugada', () => {
    const q = question();
    const second = q.options[1];
    if (!second) throw new Error('falta la opción');

    expect(optionDiagram(q, second.id).assignments).toEqual(second.assignments);
    expect(optionDiagram(q, 'otra').assignments).toEqual([]);
  });

  it('encuadra todas las opciones, también la más profunda', () => {
    expect(questionWindow(question()).maxY).toBeGreaterThanOrEqual(40);
  });

  it('letras y notas', () => {
    expect([0, 1, 2, 3].map(optionLetter)).toEqual(['A', 'B', 'C', 'D']);
    expect(scoreText({ correct: 3, total: 4 })).toBe('3 de 4');
    expect(scoreText(null)).toBeNull();
  });

  it('ordena a los jugadores por su mejor nota, sin responder al final', () => {
    const players = [
      { name: 'Ana', best: null },
      { name: 'Luis', best: { correct: 1, total: 4 } },
      { name: 'Juan', best: { correct: 3, total: 4 } },
      { name: 'Bea', best: { correct: 3, total: 4 } },
    ];
    expect(rankPlayers(players).map((player) => player.name)).toEqual([
      'Bea',
      'Juan',
      'Luis',
      'Ana',
    ]);
  });

  it('marca para repasar lo que falla más de la mitad', () => {
    expect(needsReview({ answered: 4, correct: 1 })).toBe(true);
    expect(needsReview({ answered: 4, correct: 2 })).toBe(false);
    expect(needsReview({ answered: 0, correct: 0 })).toBe(false);
  });
});

describe('positionChoices', () => {
  it('muestra las de la unidad y añade las que tienen tareas aunque sean del otro lado', () => {
    expect(
      positionChoices('offense', [
        { position: 'LB', questions: 1 },
        { position: 'WR', questions: 3 },
      ]),
    ).toEqual([
      { position: 'QB', questions: 0 },
      { position: 'RB', questions: 0 },
      { position: 'WR', questions: 3 },
      { position: 'TE', questions: 0 },
      { position: 'OL', questions: 0 },
      { position: 'LB', questions: 1 },
    ]);
  });

  it('sin el recuento todavía no sabe cuántas salen', () => {
    expect(positionChoices('defense', undefined).map((choice) => choice.questions)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('plannedQuestions', () => {
  it('suma las posiciones elegidas, con el tope del quiz', () => {
    const choices = positionChoices('offense', [
      { position: 'WR', questions: 30 },
      { position: 'TE', questions: 25 },
    ]);
    expect(plannedQuestions(choices, ['WR'])).toBe(30);
    expect(plannedQuestions(choices, ['WR', 'TE'])).toBe(40);
    expect(plannedQuestions(choices, [])).toBe(0);
  });
});
