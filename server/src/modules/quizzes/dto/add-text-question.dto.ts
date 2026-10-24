import { ApiProperty } from '@nestjs/swagger';
import {
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_TEXT_MAX,
  QUIZ_PROMPT_MAX,
} from '@playbook/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Una pregunta escrita por el coach, con respuestas de texto. */
export class AddTextQuestionDto {
  @ApiProperty({ example: '¿Qué hace el X si le juegan press?', maxLength: QUIZ_PROMPT_MAX })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Escribe la pregunta' })
  @MaxLength(QUIZ_PROMPT_MAX)
  prompt!: string;

  @ApiProperty({
    type: [String],
    minItems: QUIZ_MIN_OPTIONS,
    maxItems: QUIZ_MAX_OPTIONS,
    example: ['Release por fuera', 'Se queda quieto'],
  })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item) => trim({ value: item })) : value,
  )
  @IsArray()
  @ArrayMinSize(QUIZ_MIN_OPTIONS, { message: `Pon al menos ${QUIZ_MIN_OPTIONS} respuestas` })
  @ArrayMaxSize(QUIZ_MAX_OPTIONS, { message: `Como mucho ${QUIZ_MAX_OPTIONS} respuestas` })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Ninguna respuesta puede ir vacía' })
  @MaxLength(QUIZ_OPTION_TEXT_MAX, { each: true })
  options!: string[];

  @ApiProperty({ description: 'Posición (desde 0) de la respuesta correcta en `options`' })
  @IsInt()
  @Min(0)
  correctIndex!: number;
}
