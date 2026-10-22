import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { POSITIONS, type Position } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

@Schema({ collection: 'rosterPlayers', timestamps: true })
export class RosterPlayer {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  name!: string;

  // El dorsal no es único: dos jugadores pueden compartirlo si no juegan en la misma unidad.
  @Prop({ type: Number, required: true, min: 0, max: 99 })
  number!: number;

  @Prop({ type: [String], enum: [...POSITIONS], default: [] })
  positions!: Position[];

  @Prop({ type: String })
  photoUrl?: string;

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RosterPlayerDocument = HydratedDocument<RosterPlayer>;

export const RosterPlayerSchema = SchemaFactory.createForClass(RosterPlayer);
RosterPlayerSchema.index({ teamId: 1, active: 1, number: 1 });
