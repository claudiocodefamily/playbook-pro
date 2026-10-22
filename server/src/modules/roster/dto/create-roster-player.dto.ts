import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { POSITIONS, type Position } from '@playbook/shared';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRosterPlayerDto {
  @ApiProperty({ example: 'Carlos Ramírez', maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre del jugador es obligatorio' })
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 12, minimum: 0, maximum: 99, description: 'Dorsal' })
  @IsInt({ message: 'El dorsal debe ser un número entero' })
  @Min(0)
  @Max(99, { message: 'El dorsal debe estar entre 0 y 99' })
  number!: number;

  @ApiPropertyOptional({ enum: POSITIONS, isArray: true, example: ['QB'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(POSITIONS, {
    each: true,
    message: `Cada posición debe ser una de: ${POSITIONS.join(', ')}`,
  })
  positions?: Position[];

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/demo/image/upload/jugador.jpg' })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'La foto debe ser una URL https' },
  )
  @MaxLength(500)
  photoUrl?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'false si el jugador ya no está en el equipo',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
