import { ApiProperty } from '@nestjs/swagger';
import { QUIZ_MAX_QUESTIONS } from '@playbook/shared';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID, ValidateNested } from 'class-validator';

export class AnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID(7)
  questionId!: string;

  @ApiProperty({ format: 'uuid', description: 'La opción elegida' })
  @IsUUID(7)
  optionId!: string;
}

export class SubmitAttemptDto {
  @ApiProperty({
    type: [AnswerDto],
    description: 'Las preguntas sin responder cuentan como falladas',
  })
  @IsArray()
  @ArrayMaxSize(QUIZ_MAX_QUESTIONS)
  @ArrayUnique((answer: AnswerDto) => answer.questionId, {
    message: 'Cada pregunta se responde una sola vez',
  })
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}
