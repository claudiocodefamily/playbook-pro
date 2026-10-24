import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { POSITIONS, type Position } from '@playbook/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateQuizDto {
  @ApiProperty({ example: 'Repaso WR: semana 3', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El título del quiz es obligatorio' })
  @MaxLength(100)
  title!: string;

  @ApiProperty({ format: 'uuid', description: 'Playbook del que salen las preguntas' })
  @IsUUID(7)
  playbookId!: string;

  @ApiProperty({
    enum: POSITIONS,
    isArray: true,
    example: ['WR'],
    description: 'Posiciones por las que se pregunta',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Elige al menos una posición' })
  @ArrayUnique()
  @IsIn(POSITIONS, { each: true, message: `Las posiciones válidas son: ${POSITIONS.join(', ')}` })
  positions!: Position[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Solo estas jugadas del playbook. Sin ellas, todas.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(7, { each: true })
  playIds?: string[];
}
