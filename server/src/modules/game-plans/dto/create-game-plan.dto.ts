import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GAME_PLAN_OPPONENT_MAX } from '@playbook/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateGamePlanDto {
  @ApiProperty({ example: 'Halcones', maxLength: GAME_PLAN_OPPONENT_MAX })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el rival' })
  @MaxLength(GAME_PLAN_OPPONENT_MAX)
  opponent!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-11-07',
    description: 'Día del partido (AAAA-MM-DD)',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha va como AAAA-MM-DD' })
  gameDate?: string | null;
}
