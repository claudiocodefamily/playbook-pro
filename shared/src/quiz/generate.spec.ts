import { describe, expect, it } from 'vitest';
import {
  type Assignment,
  createEmptyDiagram,
  type DiagramPlayer,
  type PlayDiagram,
  type Point,
} from '../diagram/diagram.schema.js';
import { FIELD_HALF_WIDTH_YARDS } from '../field.js';
import { newId } from '../ids.js';
import {
  countAssignmentQuestions,
  generateAssignmentQuestions,
  type QuizSourcePlay,
} from './generate.js';
import { QuizQuestionSchema } from './quiz.schema.js';

function player(label: string, position: DiagramPlayer['position'], x: number, y: number) {
  const side = ['QB', 'RB', 'WR', 'TE', 'OL'].includes(position) ? 'O' : 'D';
  return { id: newId(), side, position, label, x, y } as DiagramPlayer;
}

function route(playerId: string, points: Point[], routeName?: string): Assignment {
  return {
    id: newId(),
    playerId,
    type: 'route',
    points,
    style: { line: 'solid', end: 'arrow', curved: false },
    startTime: 0,
    endTime: 2,
    ...(routeName ? { routeName } : {}),
  };
}

/** X con un slant hacia dentro, Z con un go y el QB sin tarea. */
function meshPlay(): { play: QuizSourcePlay; x: DiagramPlayer; z: DiagramPlayer } {
  const x = player('X', 'WR', -20, 0);
  const z = player('Z', 'WR', 20, -1);
  const qb = player('QB', 'QB', 0, -5);
  const diagram: PlayDiagram = {
    ...createEmptyDiagram(),
    players: [x, z, qb],
    assignments: [route(x.id, [{ x: -15, y: 6 }], 'slant'), route(z.id, [{ x: 20, y: 20 }], 'go')],
    notes: 'El X corre un slant',
  };
  return { play: { id: newId(), name: 'Mesh Right', diagram }, x, z };
}

/** Siempre el primero: el orden de las opciones no depende del azar en los tests. */
const fixed = () => 0;

describe('generateAssignmentQuestions', () => {
  it('pregunta por cada jugador de la posición con una tarea dibujada', () => {
    const { play } = meshPlay();
    const questions = generateAssignmentQuestions([play], { positions: ['WR'], random: fixed });

    expect(questions.map((question) => question.prompt)).toEqual([
      '¿Qué hace X (WR) en «Mesh Right»?',
      '¿Qué hace Z (WR) en «Mesh Right»?',
    ]);
    for (const question of questions) {
      expect(QuizQuestionSchema.safeParse(question).success).toBe(true);
    }
  });

  it('esconde la tarea del jugador, las notas y los dibujos', () => {
    const { play, x } = meshPlay();
    const [question] = generateAssignmentQuestions([play], { positions: ['WR'], random: fixed });

    expect(question?.playerId).toBe(x.id);
    expect(question?.diagram.assignments.some((a) => a.playerId === x.id)).toBe(false);
    expect(question?.diagram.assignments).toHaveLength(1);
    expect(question?.diagram.notes).toBe('');
  });

  it('la respuesta es su tarea; el espejo y la de otro jugador, opciones falsas', () => {
    const { play, x } = meshPlay();
    const [question] = generateAssignmentQuestions([play], { positions: ['WR'], random: fixed });
    const correct = question?.options.find((option) => option.id === question.correctOptionId);
    const ends = question?.options.map((option) => option.assignments[0]?.points.at(-1));

    expect(question?.options).toHaveLength(4);
    expect(correct?.assignments[0]?.points).toEqual([{ x: -15, y: 6 }]);
    // Espejo del slant y el go del Z trasladado al X.
    expect(ends).toEqual(
      expect.arrayContaining([
        { x: -15, y: 6 },
        { x: -25, y: 6 },
        { x: -20, y: 21 },
      ]),
    );
    // Todas las opciones son del X y sin el nombre de la ruta, que daría la respuesta.
    for (const option of question?.options ?? []) {
      for (const assignment of option.assignments) {
        expect(assignment.playerId).toBe(x.id);
        expect(assignment).not.toHaveProperty('routeName');
      }
    }
  });

  it('un blitz recto, única tarea del playbook, se completa con variantes de sí mismo', () => {
    const lb = player('M', 'LB', 0, 5);
    // Su espejo es el mismo blitz y no hay otro jugador con tarea.
    const diagram: PlayDiagram = {
      ...createEmptyDiagram(),
      players: [lb, player('DL', 'DL', 2, 1)],
      assignments: [
        {
          id: newId(),
          playerId: lb.id,
          type: 'blitz',
          points: [{ x: 0, y: -2 }],
          style: { line: 'solid', end: 'arrow', curved: false },
          startTime: 0,
          endTime: 2,
        },
      ],
    };
    const [question, ...rest] = generateAssignmentQuestions(
      [{ id: newId(), name: 'Mike Blitz', diagram }],
      { positions: ['LB'], random: fixed },
    );
    const ends = question?.options.map((option) => option.assignments[0]?.points.at(-1));

    expect(rest).toEqual([]);
    expect(QuizQuestionSchema.safeParse(question).success).toBe(true);
    // El suyo, torcido 5 yardas a cada lado y a media profundidad.
    expect(ends).toEqual(
      expect.arrayContaining([
        { x: 0, y: -2 },
        { x: 5, y: -2 },
        { x: -5, y: -2 },
        { x: 0, y: 1.5 },
      ]),
    );
  });

  it('cuenta cuántas preguntas saldrían por posición', () => {
    const { play } = meshPlay();
    const other = meshPlay().play;

    expect(countAssignmentQuestions([play, other])).toEqual({ WR: 4 });
    expect(countAssignmentQuestions([])).toEqual({});
  });

  it('usa tareas de otras jugadas, mantiene la cancha dentro de los límites y respeta el máximo', () => {
    const { play } = meshPlay();
    const other = meshPlay().play;
    const questions = generateAssignmentQuestions([play, other], {
      positions: ['WR'],
      random: fixed,
      maxQuestions: 3,
    });

    expect(questions).toHaveLength(3);
    for (const question of questions) {
      expect(QuizQuestionSchema.safeParse(question).success).toBe(true);
    }
  });

  it('una opción que se saldría por la banda se queda en la línea de banda', () => {
    const x = player('X', 'WR', -20, 0);
    const diagram: PlayDiagram = {
      ...createEmptyDiagram(),
      players: [x],
      // Su espejo acabaría en x = -30, fuera del campo.
      assignments: [route(x.id, [{ x: -10, y: 5 }])],
    };
    const [question] = generateAssignmentQuestions([{ id: newId(), name: 'Out', diagram }], {
      positions: ['WR'],
      random: fixed,
    });
    const xs = question?.options.flatMap((option) =>
      option.assignments.flatMap((a) => a.points.map((point) => point.x)),
    );

    expect(xs).toContain(-FIELD_HALF_WIDTH_YARDS);
    expect(QuizQuestionSchema.safeParse(question).success).toBe(true);
  });

  it('deja fuera a los jugadores con un marcaje individual', () => {
    const cb = player('CB', 'CB', -20, 7);
    const x = player('X', 'WR', -20, 0);
    const lb = player('M', 'LB', 0, 5);
    const diagram: PlayDiagram = {
      ...createEmptyDiagram(),
      players: [cb, x, lb],
      assignments: [
        {
          id: newId(),
          playerId: cb.id,
          type: 'man',
          targetPlayerId: x.id,
          points: [],
          style: { line: 'solid', end: 'none', curved: false },
          startTime: 0,
          endTime: 3,
        },
        {
          id: newId(),
          playerId: lb.id,
          type: 'blitz',
          points: [{ x: 2, y: -3 }],
          style: { line: 'solid', end: 'arrow', curved: false },
          startTime: 0,
          endTime: 2,
        },
      ],
    };
    const questions = generateAssignmentQuestions([{ id: newId(), name: 'Cover 1', diagram }], {
      positions: ['CB', 'LB'],
      random: fixed,
    });

    expect(questions.map((question) => question.playerId)).toEqual([lb.id]);
  });
});
