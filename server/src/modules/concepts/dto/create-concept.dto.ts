import { ApiProperty } from '@nestjs/swagger';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateConceptDto {
  @ApiProperty({ example: 'Y-Cross', maxLength: 60 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del concepto es obligatorio' })
  @MaxLength(60)
  name!: string;

  @ApiProperty({ enum: PLAYBOOK_SIDES, example: 'offense' })
  @IsIn(PLAYBOOK_SIDES, { message: `La unidad debe ser una de: ${PLAYBOOK_SIDES.join(', ')}` })
  side!: PlaybookSide;

  @ApiProperty({
    example: 'El TE cruza el campo a 15 yardas por detrás de los linebackers.',
    maxLength: 2000,
  })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty({ message: 'Explica el concepto en unas palabras' })
  @MaxLength(2000)
  explanation!: string;
}
