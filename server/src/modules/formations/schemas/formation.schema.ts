import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PLAYBOOK_SIDES, POSITIONS, type PlaybookSide, type Position } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

@Schema({ _id: false })
export class FormationSlot {
  @Prop({ type: String, required: true })
  slotId!: string; // "X", "Z", "Y", "H", "LT"...

  @Prop({ type: String, enum: [...POSITIONS], required: true })
  position!: Position;

  @Prop({ type: String, required: true })
  label!: string;

  // Yardas, mismo sistema que el diagram: y = 0 es la LOS.
  @Prop({ type: Number, required: true })
  x!: number;

  @Prop({ type: Number, required: true })
  y!: number;
}

const FormationSlotMongooseSchema = SchemaFactory.createForClass(FormationSlot);

@Schema({ collection: 'formations', timestamps: true })
export class Formation {
  @Prop(UUID_ID)
  _id!: string;

  // null = plantilla global (Shotgun, I-Form, 4-3...), visible para todos los equipos.
  @Prop({ type: String, ref: 'Team', default: null })
  teamId!: string | null;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ type: String, enum: [...PLAYBOOK_SIDES], required: true })
  side!: PlaybookSide;

  @Prop({ type: [FormationSlotMongooseSchema], required: true })
  players!: FormationSlot[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type FormationDocument = HydratedDocument<Formation>;

export const FormationSchema = SchemaFactory.createForClass(Formation);
// Un equipo no puede tener dos formaciones con el mismo nombre en la misma unidad.
FormationSchema.index({ teamId: 1, side: 1, name: 1 }, { unique: true });
