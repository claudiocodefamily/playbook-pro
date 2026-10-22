import { z } from 'zod';
import { PointSchema } from './diagram/diagram.schema.js';
import { POSITIONS } from './enums.js';

/** Máximo de jugadores en una formación: los 11 de una unidad. */
export const FORMATION_MAX_PLAYERS = 11;

/**
 * Un hueco de una formación: dónde se coloca cada jugador antes del snap.
 * Usa el mismo sistema de coordenadas que el diagram (yardas, LOS en y = 0).
 */
export const FormationSlotSchema = PointSchema.extend({
  /** Identificador del hueco dentro de la formación: "X", "LT", "Mike"... */
  slotId: z.string().min(1).max(8),
  position: z.enum(POSITIONS),
  /** Etiqueta en la cancha; mismo límite que `label` en el diagram. */
  label: z.string().min(1).max(4),
});

export type FormationSlot = z.infer<typeof FormationSlotSchema>;
