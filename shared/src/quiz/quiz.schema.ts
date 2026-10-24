import { z } from 'zod';
import { AssignmentSchema, PlayDiagramSchema } from '../diagram/diagram.schema.js';
import { UuidSchema } from '../ids.js';

/** Entre cuántas opciones elige el jugador en cada pregunta. */
export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 4;
/** Preguntas como máximo en un quiz: un repaso, no un examen eterno. */
export const QUIZ_MAX_QUESTIONS = 40;

export const QUIZ_PROMPT_MAX = 300;
export const QUIZ_OPTION_TEXT_MAX = 150;

/** Una opción dibujada: la tarea (ruta, bloqueo, zona...) que se propone para el jugador. */
const AssignmentOptionSchema = z.object({
  id: UuidSchema,
  assignments: z.array(AssignmentSchema).min(1).max(10),
});

const TextOptionSchema = z.object({
  id: UuidSchema,
  text: z.string().trim().min(1).max(QUIZ_OPTION_TEXT_MAX),
});

/**
 * "¿Qué hace el X en Mesh Right?": la jugada sin la tarea de ese jugador y varias tareas
 * dibujadas para elegir. Guarda una copia del diagram: si luego se edita la jugada, el
 * quiz sigue siendo el que respondieron los jugadores.
 */
const AssignmentQuestionSchema = z.object({
  id: UuidSchema,
  kind: z.literal('assignment'),
  prompt: z.string().min(1).max(QUIZ_PROMPT_MAX),
  playId: UuidSchema,
  playName: z.string().max(120),
  /** El jugador del diagram por el que se pregunta. */
  playerId: UuidSchema,
  diagram: PlayDiagramSchema,
  options: z.array(AssignmentOptionSchema).min(QUIZ_MIN_OPTIONS).max(QUIZ_MAX_OPTIONS),
  correctOptionId: UuidSchema,
});

/** Pregunta escrita por el coach, con respuestas de texto. */
const TextQuestionSchema = z.object({
  id: UuidSchema,
  kind: z.literal('text'),
  prompt: z.string().trim().min(1).max(QUIZ_PROMPT_MAX),
  options: z.array(TextOptionSchema).min(QUIZ_MIN_OPTIONS).max(QUIZ_MAX_OPTIONS),
  correctOptionId: UuidSchema,
});

export const QuizQuestionSchema = z
  .discriminatedUnion('kind', [AssignmentQuestionSchema, TextQuestionSchema])
  .superRefine((question, ctx) => {
    if (!question.options.some((option) => option.id === question.correctOptionId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'La respuesta correcta no está entre las opciones',
        path: ['correctOptionId'],
      });
    }
  });

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type AssignmentQuestion = Extract<QuizQuestion, { kind: 'assignment' }>;
export type TextQuestion = Extract<QuizQuestion, { kind: 'text' }>;

/**
 * Una pregunta tal como la recibe quien responde: sin la respuesta correcta, que solo
 * ven los coaches.
 */
export type QuizQuestionView = QuizQuestion extends infer Q
  ? Q extends QuizQuestion
    ? Omit<Q, 'correctOptionId'> & { correctOptionId?: string }
    : never
  : never;
