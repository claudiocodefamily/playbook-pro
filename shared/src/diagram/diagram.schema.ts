import { z } from 'zod';
import { POSITIONS } from '../enums.js';
import { FIELD_HALF_WIDTH_YARDS } from '../field.js';
import { UuidSchema } from '../ids.js';

/**
 * Documento "diagram" de una jugada.
 *
 * Sistema de coordenadas (en yardas, nunca en píxeles):
 * - y = distancia a la line of scrimmage (LOS). Negativo hacia el backfield ofensivo,
 *   positivo hacia la defensa (campo abajo).
 * - x = distancia lateral al centro del campo, de -26.67 (banda izquierda) a +26.67.
 *
 * Tiempo en segundos, con el snap en t = 0. El pre-snap usa tiempos negativos.
 *
 * Si cambia la forma de este esquema: sube DIAGRAM_SCHEMA_VERSION y añade la migración
 * en migrations.ts.
 */
export const DIAGRAM_SCHEMA_VERSION = 2 as const;

const Yards = z.number().finite();
const Seconds = z.number().finite().min(-10).max(30);

export const PointSchema = z.object({
  x: Yards.min(-FIELD_HALF_WIDTH_YARDS).max(FIELD_HALF_WIDTH_YARDS),
  // Hasta 75 yardas campo abajo: lo que recorre un kickoff o un field goal largo.
  y: Yards.min(-20).max(75),
});

export const FieldSchema = z.object({
  /** Yarda donde está el balón, de 1 (propia yarda 1) a 99 (yarda 1 rival). */
  yardLine: z.number().int().min(1).max(99),
  hash: z.enum(['left', 'middle', 'right']),
});

export const DiagramPlayerSchema = PointSchema.extend({
  id: UuidSchema,
  side: z.enum(['O', 'D']),
  position: z.enum(POSITIONS),
  number: z.number().int().min(0).max(99).optional(),
  /** Etiqueta corta en la cancha: "X", "Z", "Mike", "Will"... */
  label: z.string().max(4),
  rosterPlayerId: UuidSchema.optional(),
});

export const StrokeStyleSchema = z.object({
  line: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  /** "block" es la T al final de un bloqueo. */
  end: z.enum(['arrow', 'block', 'none']).default('arrow'),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  curved: z.boolean().default(false),
});

const AssignmentBase = z.object({
  id: UuidSchema,
  playerId: UuidSchema,
  style: StrokeStyleSchema,
  startTime: Seconds,
  endTime: Seconds,
});

const PathAssignmentSchema = AssignmentBase.extend({
  type: z.enum(['route', 'motion', 'blitz']),
  points: z.array(PointSchema).min(1).max(20),
  /** Nombre de la ruta del route tree: "slant", "post", "wheel"... */
  routeName: z.string().max(30).optional(),
});

const BlockAssignmentSchema = AssignmentBase.extend({
  type: z.literal('block'),
  points: z.array(PointSchema).min(1).max(10),
  targetPlayerId: UuidSchema.optional(),
});

const ManAssignmentSchema = AssignmentBase.extend({
  type: z.literal('man'),
  /** Jugador al que cubre. */
  targetPlayerId: UuidSchema,
  points: z.array(PointSchema).max(0).default([]),
});

const ZoneAssignmentSchema = AssignmentBase.extend({
  type: z.literal('zone'),
  /** Un único punto: el centro de la zona. */
  points: z.array(PointSchema).length(1),
  zone: z.object({
    shape: z.enum(['ellipse', 'rect']),
    width: z
      .number()
      .positive()
      .max(FIELD_HALF_WIDTH_YARDS * 2),
    depth: z.number().positive().max(40),
    /** "deep half", "flat", "hook/curl"... */
    name: z.string().max(30).optional(),
  }),
});

export const AssignmentSchema = z.discriminatedUnion('type', [
  PathAssignmentSchema,
  BlockAssignmentSchema,
  ManAssignmentSchema,
  ZoneAssignmentSchema,
]);

export const BallSchema = z.object({
  carrierTimeline: z
    .array(
      z.object({
        t: Seconds,
        /** Quién recibe el balón. Una patada a un punto (field goal) no tiene receptor. */
        playerId: UuidSchema.optional(),
        action: z.enum(['snap', 'handoff', 'pitch', 'pass', 'kick', 'fumble']).optional(),
        /** Solo en las patadas sin receptor: dónde cae el balón. */
        target: PointSchema.optional(),
      }),
    )
    .max(10),
});

export const TimelineSchema = z.object({
  duration: z.number().positive().max(20),
  /** Cuánto pre-snap se anima, en segundos negativos (p. ej. -3). */
  start: Seconds.max(0),
  keyframes: z
    .array(
      z.object({
        t: Seconds,
        /** "Snap", "QB drop", "Throw"... */
        label: z.string().max(40),
      }),
    )
    .max(30),
});

export const PlayDiagramSchema = z
  .object({
    schemaVersion: z.literal(DIAGRAM_SCHEMA_VERSION),
    field: FieldSchema,
    players: z.array(DiagramPlayerSchema).max(22),
    assignments: z.array(AssignmentSchema).max(60),
    ball: BallSchema,
    timeline: TimelineSchema,
    notes: z.string().max(5000).default(''),
  })
  .superRefine((diagram, ctx) => {
    const playerIds = new Set<string>();
    diagram.players.forEach((player, index) => {
      if (playerIds.has(player.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Jugador duplicado: ${player.id}`,
          path: ['players', index, 'id'],
        });
      }
      playerIds.add(player.id);
    });

    for (const side of ['O', 'D'] as const) {
      if (diagram.players.filter((player) => player.side === side).length > 11) {
        ctx.addIssue({
          code: 'custom',
          message: `Más de 11 jugadores en el lado ${side}`,
          path: ['players'],
        });
      }
    }

    diagram.assignments.forEach((assignment, index) => {
      if (!playerIds.has(assignment.playerId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Asignación a un jugador inexistente',
          path: ['assignments', index, 'playerId'],
        });
      }
      if (assignment.endTime < assignment.startTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'endTime es anterior a startTime',
          path: ['assignments', index, 'endTime'],
        });
      }
      if (
        'targetPlayerId' in assignment &&
        assignment.targetPlayerId !== undefined &&
        !playerIds.has(assignment.targetPlayerId)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'El objetivo de la asignación no existe',
          path: ['assignments', index, 'targetPlayerId'],
        });
      }
    });

    diagram.ball.carrierTimeline.forEach((entry, index) => {
      if (entry.playerId === undefined) {
        if (entry.action !== 'kick' || entry.target === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Sin receptor solo puede ir una patada con destino',
            path: ['ball', 'carrierTimeline', index, 'playerId'],
          });
        }
      } else if (!playerIds.has(entry.playerId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'El portador del balón no existe',
          path: ['ball', 'carrierTimeline', index, 'playerId'],
        });
      }
    });
  });

export type PlayDiagram = z.infer<typeof PlayDiagramSchema>;
export type PlayDiagramInput = z.input<typeof PlayDiagramSchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export type DiagramPlayer = z.infer<typeof DiagramPlayerSchema>;
export type Point = z.infer<typeof PointSchema>;

/** Diagram vacío para una jugada nueva: balón en la propia 25, en el centro. */
export function createEmptyDiagram(): PlayDiagram {
  return {
    schemaVersion: DIAGRAM_SCHEMA_VERSION,
    field: { yardLine: 25, hash: 'middle' },
    players: [],
    assignments: [],
    ball: { carrierTimeline: [] },
    timeline: { duration: 6, start: 0, keyframes: [{ t: 0, label: 'Snap' }] },
    notes: '',
  };
}
