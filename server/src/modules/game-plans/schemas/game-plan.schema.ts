import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

/** Una situación del partido (3rd & largo, red zone...) con sus jugadas en orden. */
export interface GamePlanSituation {
  id: string;
  name: string;
  playIds: string[];
}

@Schema({ collection: 'game_plans', timestamps: true, minimize: false })
export class GamePlan {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  opponent!: string;

  // Solo el día ("2026-11-07"): sin hora, así no cambia con la zona horaria.
  @Prop({ type: String, default: null })
  gameDate!: string | null;

  // Las jugadas se guardan por id: si se editan, el game plan ve la versión nueva.
  @Prop({ type: [Object], default: [] })
  situations!: GamePlanSituation[];

  // Los jugadores solo ven los game plans que el coach publica.
  @Prop({ type: Boolean, default: false })
  visibleToPlayers!: boolean;

  @Prop({ type: String, ref: 'User', required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type GamePlanDocument = HydratedDocument<GamePlan>;

export const GamePlanSchema = SchemaFactory.createForClass(GamePlan);
GamePlanSchema.index({ teamId: 1, gameDate: -1 });
