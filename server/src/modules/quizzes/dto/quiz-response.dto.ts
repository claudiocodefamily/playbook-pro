import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { migrateDiagram, type QuizQuestion, type QuizQuestionView } from '@playbook/shared';
import type { QuizDocument } from '../schemas/quiz.schema.js';

/** Mejor intento de quien pregunta. */
export class QuizScoreDto {
  @ApiProperty()
  correct!: number;

  @ApiProperty()
  total!: number;
}

/** Datos de un quiz sin las preguntas: para listados. */
export class QuizSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ format: 'uuid' })
  playbookId!: string;

  @ApiProperty({ example: 'Repaso WR: semana 3' })
  title!: string;

  @ApiProperty()
  questionCount!: number;

  @ApiProperty({ description: 'Si los jugadores con cuenta pueden responderlo' })
  visibleToPlayers!: boolean;

  @ApiProperty({ description: 'Cuántas veces lo has respondido tú' })
  myAttempts!: number;

  @ApiPropertyOptional({ type: QuizScoreDto, nullable: true, description: 'Tu mejor nota' })
  myBest!: QuizScoreDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(
    quiz: QuizDocument,
    mine: { attempts: number; best: QuizScoreDto | null } = { attempts: 0, best: null },
  ): QuizSummaryResponseDto {
    const dto = new QuizSummaryResponseDto();
    QuizSummaryResponseDto.fill(dto, quiz, mine);
    return dto;
  }

  protected static fill(
    dto: QuizSummaryResponseDto,
    quiz: QuizDocument,
    mine: { attempts: number; best: QuizScoreDto | null },
  ): void {
    dto.id = quiz._id;
    dto.teamId = quiz.teamId;
    dto.playbookId = quiz.playbookId;
    dto.title = quiz.title;
    dto.questionCount = quiz.questions.length;
    dto.visibleToPlayers = quiz.visibleToPlayers;
    dto.myAttempts = mine.attempts;
    dto.myBest = mine.best;
    dto.createdAt = quiz.createdAt;
    dto.updatedAt = quiz.updatedAt;
  }
}

export class QuizResponseDto extends QuizSummaryResponseDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'Preguntas (QuizQuestionSchema de @playbook/shared). `correctOptionId` solo llega a los coaches.',
  })
  questions!: QuizQuestionView[];

  static fromQuiz(
    quiz: QuizDocument,
    {
      withAnswers,
      mine,
    }: { withAnswers: boolean; mine?: { attempts: number; best: QuizScoreDto | null } },
  ): QuizResponseDto {
    const dto = new QuizResponseDto();
    QuizSummaryResponseDto.fill(dto, quiz, mine ?? { attempts: 0, best: null });
    dto.questions = quiz.questions.map((question): QuizQuestionView => {
      // Las copias del diagram se guardaron con la versión de entonces: se ponen al día.
      const current: QuizQuestion =
        question.kind === 'assignment'
          ? { ...question, diagram: migrateDiagram(question.diagram) }
          : question;
      if (withAnswers) return current;
      const { correctOptionId: _answer, ...rest } = current;
      return rest;
    });
    return dto;
  }
}

export class QuestionResultDto {
  @ApiProperty({ format: 'uuid' })
  questionId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  optionId!: string | null;

  @ApiProperty({ format: 'uuid' })
  correctOptionId!: string;

  @ApiProperty()
  isCorrect!: boolean;
}

export class AttemptResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  correct!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [QuestionResultDto] })
  results!: QuestionResultDto[];

  @ApiProperty()
  createdAt!: Date;
}
