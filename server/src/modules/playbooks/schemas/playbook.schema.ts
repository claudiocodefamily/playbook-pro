import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

@Schema({ collection: 'playbooks', timestamps: true })
export class Playbook {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  name!: string;

  @Prop({ type: String, enum: [...PLAYBOOK_SIDES], required: true })
  side!: PlaybookSide;

  @Prop({ type: String, default: '', maxlength: 2000 })
  description!: string;

  // Los jugadores con cuenta solo ven los playbooks que el coach hace visibles.
  @Prop({ type: Boolean, default: false })
  visibleToPlayers!: boolean;

  // Borrado lógico: el playbook y sus jugadas se ocultan pero no se pierden.
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PlaybookDocument = HydratedDocument<Playbook>;

export const PlaybookSchema = SchemaFactory.createForClass(Playbook);
PlaybookSchema.index({ teamId: 1, side: 1, deletedAt: 1 });
