import { ApiProperty } from '@nestjs/swagger';
import { QuizScoreDto } from './quiz-response.dto.js';

export class LastAttemptDto extends QuizScoreDto {
  @ApiProperty()
  at!: Date;
}

/** Cómo le fue a un jugador con cuenta. */
export class PlayerQuizResultDto {
  @ApiProperty({ format: 'uuid', description: 'Su ficha del roster' })
  rosterPlayerId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ description: 'Nombre de su cuenta' })
  name!: string;

  @ApiProperty()
  attempts!: number;

  @ApiProperty({ type: QuizScoreDto, nullable: true })
  best!: QuizScoreDto | null;

  @ApiProperty({ type: LastAttemptDto, nullable: true })
  last!: LastAttemptDto | null;
}

/** Aciertos de una pregunta, contando el último intento de cada jugador. */
export class QuestionStatsDto {
  @ApiProperty({ format: 'uuid' })
  questionId!: string;

  @ApiProperty({ description: 'Jugadores cuyo último intento incluye la pregunta' })
  answered!: number;

  @ApiProperty()
  correct!: number;
}

export class QuizResultsResponseDto {
  @ApiProperty({ type: [PlayerQuizResultDto] })
  players!: PlayerQuizResultDto[];

  @ApiProperty({ type: [QuestionStatsDto] })
  questions!: QuestionStatsDto[];
}
