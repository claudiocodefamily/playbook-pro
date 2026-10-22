import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { PlayDiagram } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

/** Foto del diagram que se guarda cuando el coach pulsa "Guardar versión". */
@Schema({
  collection: 'playVersions',
  timestamps: { createdAt: true, updatedAt: false },
  minimize: false,
})
export class PlayVersion {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Play', required: true })
  playId!: string;

  // Duplicado a propósito: permite filtrar por equipo sin consultar plays.
  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  // La `version` que tenía la jugada al guardar esta foto.
  @Prop({ type: Number, required: true })
  version!: number;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ type: Object, required: true })
  diagram!: PlayDiagram;

  @Prop({ type: String, ref: 'User', required: true })
  createdBy!: string;

  createdAt!: Date;
}

export type PlayVersionDocument = HydratedDocument<PlayVersion>;

export const PlayVersionSchema = SchemaFactory.createForClass(PlayVersion);
PlayVersionSchema.index({ playId: 1, version: -1 }, { unique: true });
