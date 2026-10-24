import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  GAME_PLAN_MAX_PLAYS_PER_SITUATION,
  GAME_PLAN_MAX_SITUATIONS,
  GAME_PLAN_SITUATION_NAME_MAX,
} from '@playbook/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateGamePlanDto } from './create-game-plan.dto.js';

export class GamePlanSituationDto {
  @ApiProperty({ format: 'uuid', description: 'Lo genera la app (UUIDv7) al crear la situación' })
  @IsUUID(7)
  id!: string;

  @ApiProperty({ example: '3rd & largo (7+)', maxLength: GAME_PLAN_SITUATION_NAME_MAX })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Cada situación necesita un nombre' })
  @MaxLength(GAME_PLAN_SITUATION_NAME_MAX)
  name!: string;

  @ApiProperty({ type: [String], format: 'uuid', description: 'Jugadas, en orden' })
  @IsArray()
  @ArrayMaxSize(GAME_PLAN_MAX_PLAYS_PER_SITUATION, {
    message: `Como mucho ${GAME_PLAN_MAX_PLAYS_PER_SITUATION} jugadas por situación`,
  })
  @ArrayUnique({ message: 'Una jugada no puede repetirse en la misma situación' })
  @IsUUID(7, { each: true })
  playIds!: string[];
}

export class UpdateGamePlanDto extends PartialType(CreateGamePlanDto) {
  @ApiPropertyOptional({ description: 'Si los jugadores con cuenta pueden verlo' })
  @IsOptional()
  @IsBoolean()
  visibleToPlayers?: boolean;

  @ApiPropertyOptional({
    type: [GamePlanSituationDto],
    description: 'Todas las situaciones, en orden: sustituyen a las que había',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(GAME_PLAN_MAX_SITUATIONS, {
    message: `Como mucho ${GAME_PLAN_MAX_SITUATIONS} situaciones`,
  })
  @ArrayUnique((situation: GamePlanSituationDto) => situation.id)
  @ValidateNested({ each: true })
  @Type(() => GamePlanSituationDto)
  situations?: GamePlanSituationDto[];
}
