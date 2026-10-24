import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { QuizQuestion } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

// minimize: false → se guardan también los objetos y arrays vacíos de los diagrams.
@Schema({ collection: 'quizzes', timestamps: true, minimize: false })
export class Quiz {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  // Del que salieron las preguntas. Las preguntas son una copia: el quiz no cambia si
  // luego se editan o borran las jugadas.
  @Prop({ type: String, ref: 'Playbook', required: true })
  playbookId!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  title!: string;

  // Objetos libres para Mongoose; la forma real la garantiza QuizQuestionSchema (Zod).
  @Prop({ type: [Object], default: [] })
  questions!: QuizQuestion[];

  // Los jugadores solo ven los quizzes que el coach publica.
  @Prop({ type: Boolean, default: false })
  visibleToPlayers!: boolean;

  @Prop({ type: String, ref: 'User', required: true })
  createdBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type QuizDocument = HydratedDocument<Quiz>;

export const QuizSchema = SchemaFactory.createForClass(Quiz);
QuizSchema.index({ teamId: 1, createdAt: -1 });
