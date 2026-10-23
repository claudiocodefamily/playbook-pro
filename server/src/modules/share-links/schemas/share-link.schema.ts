import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

/**
 * Link de solo lectura a un playbook, para mandarlo a los jugadores. Del token solo se
 * guarda el hash: si alguien lee la base de datos no puede abrir los links.
 */
@Schema({ collection: 'share_links', timestamps: true })
export class ShareLink {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  @Prop({ type: String, ref: 'Playbook', required: true })
  playbookId!: string;

  /** SHA-256 del token, en hexadecimal. */
  @Prop({ type: String, required: true })
  tokenHash!: string;

  /** Para quién es: "Receptores", "Toda la ofensiva"... */
  @Prop({ type: String, default: '', trim: true, maxlength: 60 })
  label!: string;

  /** null = no caduca. */
  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, ref: 'User', required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ShareLinkDocument = HydratedDocument<ShareLink>;

export const ShareLinkSchema = SchemaFactory.createForClass(ShareLink);
ShareLinkSchema.index({ tokenHash: 1 }, { unique: true });
ShareLinkSchema.index({ teamId: 1, playbookId: 1, revokedAt: 1 });
