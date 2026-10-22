import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { RULESETS, type Ruleset, TEAM_ROLES, type TeamRole } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

@Schema({ _id: false })
export class TeamMember {
  @Prop({ type: String, ref: 'User', required: true })
  userId!: string;

  // Único rol en la Fase 1; PLAYER llegará en la Fase 3.
  @Prop({ type: String, enum: [...TEAM_ROLES], default: 'COACH' })
  role!: TeamRole;

  @Prop({ type: Date, default: () => new Date() })
  joinedAt!: Date;
}

const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

@Schema({ collection: 'teams', timestamps: true })
export class Team {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ type: String })
  logoUrl?: string;

  // Reglamento: define la separación de los hash marks al dibujar la cancha.
  @Prop({ type: String, enum: [...RULESETS], default: 'college' })
  ruleset!: Ruleset;

  @Prop({ type: [TeamMemberSchema], default: [] })
  members!: TeamMember[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type TeamDocument = HydratedDocument<Team>;

export const TeamSchema = SchemaFactory.createForClass(Team);
// "¿De qué equipos soy coach?"
TeamSchema.index({ 'members.userId': 1 });
