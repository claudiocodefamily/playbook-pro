import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

/**
 * Invitación de un solo uso para que un jugador del roster cree su cuenta y entre al
 * equipo. Como en los links compartidos, del token solo se guarda el hash.
 */
@Schema({ collection: 'player_invites', timestamps: true })
export class PlayerInvite {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  @Prop({ type: String, ref: 'RosterPlayer', required: true })
  rosterPlayerId!: string;

  /** SHA-256 del token, en hexadecimal. */
  @Prop({ type: String, required: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Cuándo se usó; una invitación usada ya no sirve. */
  @Prop({ type: Date, default: null })
  usedAt!: Date | null;

  @Prop({ type: String, ref: 'User', required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PlayerInviteDocument = HydratedDocument<PlayerInvite>;

export const PlayerInviteSchema = SchemaFactory.createForClass(PlayerInvite);
PlayerInviteSchema.index({ tokenHash: 1 }, { unique: true });
// "¿Qué invitaciones pendientes tiene el equipo?"
PlayerInviteSchema.index({ teamId: 1, rosterPlayerId: 1, usedAt: 1 });
