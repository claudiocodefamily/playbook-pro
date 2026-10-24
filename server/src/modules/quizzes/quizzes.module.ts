import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlaybooksModule } from '../playbooks/playbooks.module.js';
import { Play, PlaySchema } from '../plays/schemas/play.schema.js';
import { TeamsModule } from '../teams/teams.module.js';
import { QuizzesController } from './quizzes.controller.js';
import { QuizzesService } from './quizzes.service.js';
import { QuizAttempt, QuizAttemptSchema } from './schemas/quiz-attempt.schema.js';
import { Quiz, QuizSchema } from './schemas/quiz.schema.js';

@Module({
  imports: [
    TeamsModule,
    PlaybooksModule,
    MongooseModule.forFeature([
      { name: Quiz.name, schema: QuizSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      // Para sacar las preguntas de las jugadas dibujadas.
      { name: Play.name, schema: PlaySchema },
    ]),
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
})
export class QuizzesModule {}
