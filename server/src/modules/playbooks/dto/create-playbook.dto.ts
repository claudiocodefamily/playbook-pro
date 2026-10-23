import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePlaybookDto {
  @ApiProperty({ example: 'Ofensiva 2026', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre del playbook es obligatorio' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: PLAYBOOK_SIDES, example: 'offense' })
  @IsIn(PLAYBOOK_SIDES, { message: `La unidad debe ser una de: ${PLAYBOOK_SIDES.join(', ')}` })
  side!: PlaybookSide;

  @ApiPropertyOptional({ example: 'Jugadas base de la temporada', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Si los jugadores con cuenta pueden ver el playbook',
  })
  @IsOptional()
  @IsBoolean()
  visibleToPlayers?: boolean;
}
