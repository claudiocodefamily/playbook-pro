import type { Assignment, DiagramPlayer, PlayDiagram, Point } from '../diagram/diagram.schema.js';
import type { Position } from '../enums.js';
import { FIELD_HALF_WIDTH_YARDS } from '../field.js';
import { newId } from '../ids.js';
import { type AssignmentQuestion, QUIZ_MAX_OPTIONS, QUIZ_MAX_QUESTIONS } from './quiz.schema.js';

export interface QuizSourcePlay {
  id: string;
  name: string;
  diagram: PlayDiagram;
}

export interface GenerateQuizOptions {
  /** Posiciones por las que se pregunta: "WR", "LB"... */
  positions: readonly Position[];
  /** Para barajar las opciones. Los tests pasan uno fijo. */
  random?: () => number;
  maxQuestions?: number;
}

/** Límites del esquema del diagram para los puntos (yardas). */
const MIN_Y = -20;
const MAX_Y = 75;
/** Dos tareas cuyos puntos coinciden redondeando a esta rejilla cuentan como la misma. */
const SAME_SHAPE_YARDS = 2;

/**
 * Tipos de tarea que se pueden trasladar a otro jugador. Un marcaje (man) depende de a quién
 * cubre, así que los jugadores con uno no entran en el quiz automático.
 */
type MovableAssignment = Exclude<Assignment, { type: 'man' }>;

/** Una tarea relativa a su jugador: así se puede "probar" en otro jugador. */
interface Shape {
  assignments: MovableAssignment[];
  origin: Point;
  key: string;
}

function isMovable(assignment: Assignment): assignment is MovableAssignment {
  return assignment.type !== 'man';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** La forma de una tarea, sin pistas de texto (nombre de la ruta) ni a quién bloquea. */
function shapeOf(player: DiagramPlayer, assignments: readonly Assignment[]): Shape | null {
  if (assignments.length === 0 || !assignments.every(isMovable)) return null;
  const cleaned = assignments.filter(isMovable).map((assignment): MovableAssignment => {
    if (assignment.type === 'block') {
      const { targetPlayerId: _target, ...rest } = assignment;
      return rest;
    }
    if (assignment.type === 'zone') return assignment;
    const { routeName: _name, ...rest } = assignment;
    return rest;
  });
  const key = cleaned
    .map(
      (assignment) =>
        `${assignment.type}:${assignment.points
          .map(
            (point) =>
              `${Math.round((point.x - player.x) / SAME_SHAPE_YARDS)},${Math.round((point.y - player.y) / SAME_SHAPE_YARDS)}`,
          )
          .join(';')}`,
    )
    .join('|');
  return { assignments: cleaned, origin: { x: player.x, y: player.y }, key };
}

/** Cómo se deforma una tarea al trasladarla: recibe y devuelve la distancia al jugador. */
type Bend = (offset: Point) => Point;

const same: Bend = (offset) => offset;
const mirrored: Bend = ({ x, y }) => ({ x: -x, y });

/** Yardas que se tuerce una variante hacia un lado: un gap o una ruta de distancia. */
const VARIANT_SHIFT_YARDS = 5;

/**
 * Variantes de la propia tarea, para cuando no hay bastantes tareas de otros jugadores:
 * torcida hacia un lado, hacia el otro, o a la mitad de profundidad. Así un blitz recto, que
 * es igual a su espejo, sigue teniendo opciones falsas aunque sea la única tarea dibujada.
 */
const VARIANTS: readonly Bend[] = [
  ({ x, y }) => ({ x: x + VARIANT_SHIFT_YARDS, y }),
  ({ x, y }) => ({ x: x - VARIANT_SHIFT_YARDS, y }),
  ({ x, y }) => ({ x, y: y / 2 }),
];

/** Lleva una forma al jugador `player`, opcionalmente deformada (en espejo, torcida…). */
function placeShape(
  shape: Shape,
  player: DiagramPlayer,
  bend: Bend = same,
): { assignments: Assignment[]; key: string } {
  const move = (point: Point): Point => {
    const offset = bend({ x: point.x - shape.origin.x, y: point.y - shape.origin.y });
    return {
      // Primero se redondea y luego se recorta: redondear la banda (26.666…) la sacaría del campo.
      x: clamp(round(player.x + offset.x), -FIELD_HALF_WIDTH_YARDS, FIELD_HALF_WIDTH_YARDS),
      y: clamp(round(player.y + offset.y), MIN_Y, MAX_Y),
    };
  };
  const assignments = shape.assignments.map((assignment): Assignment => ({
    ...assignment,
    id: newId(),
    playerId: player.id,
    points: assignment.points.map(move),
  }));
  return { assignments, key: shapeOf(player, assignments)?.key ?? '' };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

function describePlayer(player: DiagramPlayer): string {
  return player.label === player.position ? player.label : `${player.label} (${player.position})`;
}

/**
 * Preguntas "¿qué hace este jugador?" a partir de las jugadas dibujadas. Para cada jugador
 * de las posiciones pedidas con una tarea dibujada: la respuesta es su tarea, y las
 * opciones falsas son su tarea en espejo y las tareas de otros jugadores del mismo lado
 * (de esta jugada o de las otras), puestas en su sitio. Si faltan, se completan con
 * variantes de su propia tarea. Si aun así no hay una opción falsa distinta, no entra.
 */
export function generateAssignmentQuestions(
  plays: readonly QuizSourcePlay[],
  { positions, random = Math.random, maxQuestions = QUIZ_MAX_QUESTIONS }: GenerateQuizOptions,
): AssignmentQuestion[] {
  const wanted = new Set<Position>(positions);
  const shapes = plays.flatMap((play) =>
    play.diagram.players.flatMap((player) => {
      const shape = shapeOf(
        player,
        play.diagram.assignments.filter((assignment) => assignment.playerId === player.id),
      );
      return shape ? [{ playId: play.id, player, shape }] : [];
    }),
  );

  const questions: AssignmentQuestion[] = [];
  for (const play of plays) {
    const players = play.diagram.players
      .filter((player) => wanted.has(player.position))
      .sort((a, b) => a.label.localeCompare(b.label));
    for (const player of players) {
      if (questions.length >= maxQuestions) return questions;
      const own = shapes.find(
        (candidate) => candidate.playId === play.id && candidate.player.id === player.id,
      );
      if (!own) continue;
      const correct = placeShape(own.shape, player);
      const seen = new Set([correct.key]);
      const distractors: Assignment[][] = [];
      const offer = (option: { assignments: Assignment[]; key: string }) => {
        if (distractors.length >= QUIZ_MAX_OPTIONS - 1 || seen.has(option.key)) return;
        seen.add(option.key);
        distractors.push(option.assignments);
      };
      // El espejo primero: confundir un slant hacia dentro con uno hacia fuera es el error típico.
      offer(placeShape(own.shape, player, mirrored));
      const others = shapes.filter(
        (candidate) => candidate !== own && candidate.player.side === player.side,
      );
      for (const other of shuffle(others, random)) offer(placeShape(other.shape, player));
      for (const variant of VARIANTS) offer(placeShape(own.shape, player, variant));
      if (distractors.length === 0) continue;

      const correctOption = { id: newId(), assignments: correct.assignments };
      const options = shuffle(
        [correctOption, ...distractors.map((assignments) => ({ id: newId(), assignments }))],
        random,
      );
      questions.push({
        id: newId(),
        kind: 'assignment',
        prompt: `¿Qué hace ${describePlayer(player)} en «${play.name}»?`,
        playId: play.id,
        playName: play.name,
        playerId: player.id,
        diagram: {
          ...play.diagram,
          assignments: play.diagram.assignments.filter(
            (assignment) => assignment.playerId !== player.id,
          ),
          // Las notas y los rayones del lápiz podrían chivar la respuesta.
          notes: '',
          drawings: [],
        },
        options,
        correctOptionId: correctOption.id,
      });
    }
  }
  return questions;
}

/**
 * Cuántas preguntas saldrían por cada posición, sin el límite de preguntas: sirve para que el
 * coach vea qué posiciones tienen tareas dibujadas antes de crear el quiz.
 */
export function countAssignmentQuestions(
  plays: readonly QuizSourcePlay[],
): Partial<Record<Position, number>> {
  // Por jugada y jugador: una jugada duplicada puede repetir los ids de sus jugadores.
  const positionOf = new Map(
    plays.flatMap((play) =>
      play.diagram.players.map((player) => [`${play.id}:${player.id}`, player.position] as const),
    ),
  );
  const counts: Partial<Record<Position, number>> = {};
  for (const question of generateAssignmentQuestions(plays, {
    positions: [...new Set(positionOf.values())],
    maxQuestions: Number.POSITIVE_INFINITY,
  })) {
    const position = positionOf.get(`${question.playId}:${question.playerId}`);
    if (position) counts[position] = (counts[position] ?? 0) + 1;
  }
  return counts;
}
