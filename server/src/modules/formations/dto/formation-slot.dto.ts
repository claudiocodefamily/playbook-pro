import { ApiProperty } from '@nestjs/swagger';
import { FIELD_HALF_WIDTH_YARDS, POSITIONS, type Position } from '@playbook/shared';
import { IsIn, IsNumber, IsString, Length, Max, Min } from 'class-validator';

export class FormationSlotDto {
  @ApiProperty({ example: 'X', minLength: 1, maxLength: 8, description: 'Id del hueco' })
  @IsString()
  @Length(1, 8)
  slotId!: string;

  @ApiProperty({ enum: POSITIONS, example: 'WR' })
  @IsIn(POSITIONS, { message: `La posición debe ser una de: ${POSITIONS.join(', ')}` })
  position!: Position;

  @ApiProperty({ example: 'X', minLength: 1, maxLength: 4, description: 'Etiqueta en la cancha' })
  @IsString()
  @Length(1, 4, { message: 'La etiqueta debe tener de 1 a 4 caracteres' })
  label!: string;

  @ApiProperty({
    example: -20,
    minimum: -FIELD_HALF_WIDTH_YARDS,
    maximum: FIELD_HALF_WIDTH_YARDS,
    description: 'Yardas desde el centro del campo (negativo = izquierda)',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-FIELD_HALF_WIDTH_YARDS)
  @Max(FIELD_HALF_WIDTH_YARDS)
  x!: number;

  @ApiProperty({
    example: -1,
    minimum: -20,
    maximum: 60,
    description: 'Yardas desde la LOS (negativo = backfield ofensivo)',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-20)
  @Max(60)
  y!: number;
}
