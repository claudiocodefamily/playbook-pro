import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

/** Un término del glosario: Mesh, Cover 2, Zone Read... */
@Schema({ collection: 'concepts', timestamps: true })
export class Concept {
  @Prop(UUID_ID)
  _id!: string;

  // null = concepto global del glosario, visible para todos los equipos.
  @Prop({ type: String, ref: 'Team', default: null })
  teamId!: string | null;

  @Prop({ type: String, required: true, trim: true, maxlength: 60 })
  name!: string;

  /** Unidad a la que pertenece: ataque, defensa o special teams. */
  @Prop({ type: String, enum: [...PLAYBOOK_SIDES], required: true })
  side!: PlaybookSide;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  explanation!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ConceptDocument = HydratedDocument<Concept>;

export const ConceptSchema = SchemaFactory.createForClass(Concept);
// Un equipo no repite nombre (sin distinguir mayúsculas); el listado va por unidad.
ConceptSchema.index(
  { teamId: 1, name: 1 },
  { unique: true, collation: { locale: 'es', strength: 2 } },
);
ConceptSchema.index({ teamId: 1, side: 1 });
