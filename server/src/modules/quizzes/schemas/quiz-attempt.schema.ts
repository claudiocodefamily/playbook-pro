import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

export interface QuizAnswer {
  questionId: string;
  /** null si la dejó sin responder. */
  optionId: string | null;
  isCorrect: boolean;
}

/** Una vez que alguien responde un quiz. Se puede repetir: cada intento queda guardado. */
@Schema({ collection: 'quiz_attempts', timestamps: true })
export class QuizAttempt {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  @Prop({ type: String, ref: 'Quiz', required: true })
  quizId!: string;

  @Prop({ type: String, ref: 'User', required: true })
  userId!: string;

  @Prop({ type: [Object], default: [] })
  answers!: QuizAnswer[];

  @Prop({ type: Number, required: true })
  correct!: number;

  @Prop({ type: Number, required: true })
  total!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);
QuizAttemptSchema.index({ teamId: 1, quizId: 1, userId: 1, createdAt: -1 });
