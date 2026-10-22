import { ApiProperty } from '@nestjs/swagger';
import { FORMATION_MAX_PLAYERS, PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FormationSlotDto } from './formation-slot.dto.js';

export class CreateFormationDto {
  @ApiProperty({ example: 'Trips Right', maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la formación es obligatorio' })
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: PLAYBOOK_SIDES, example: 'offense' })
  @IsIn(PLAYBOOK_SIDES, { message: `La unidad debe ser una de: ${PLAYBOOK_SIDES.join(', ')}` })
  side!: PlaybookSide;

  @ApiProperty({ type: [FormationSlotDto], minItems: 1, maxItems: FORMATION_MAX_PLAYERS })
  @IsArray()
  @ArrayMinSize(1, { message: 'La formación necesita al menos un jugador' })
  @ArrayMaxSize(FORMATION_MAX_PLAYERS, {
    message: `Una formación tiene como máximo ${FORMATION_MAX_PLAYERS} jugadores`,
  })
  @ArrayUnique((slot: FormationSlotDto) => slot.slotId, {
    message: 'Cada hueco de la formación necesita un slotId distinto',
  })
  @ValidateNested({ each: true })
  @Type(() => FormationSlotDto)
  players!: FormationSlotDto[];
}
