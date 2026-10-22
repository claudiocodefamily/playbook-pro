import { ApiProperty } from '@nestjs/swagger';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import type { FormationDocument } from '../schemas/formation.schema.js';
import { FormationSlotDto } from './formation-slot.dto.js';

export class FormationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'null en las formaciones globales',
  })
  teamId!: string | null;

  @ApiProperty({ description: 'true = plantilla global; no se puede editar ni borrar' })
  isGlobal!: boolean;

  @ApiProperty({ example: 'Shotgun' })
  name!: string;

  @ApiProperty({ enum: PLAYBOOK_SIDES })
  side!: PlaybookSide;

  @ApiProperty({ type: [FormationSlotDto] })
  players!: FormationSlotDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(formation: FormationDocument): FormationResponseDto {
    const dto = new FormationResponseDto();
    dto.id = formation._id;
    dto.teamId = formation.teamId;
    dto.isGlobal = formation.teamId === null;
    dto.name = formation.name;
    dto.side = formation.side;
    dto.players = formation.players.map(({ slotId, position, label, x, y }) => ({
      slotId,
      position,
      label,
      x,
      y,
    }));
    dto.createdAt = formation.createdAt;
    dto.updatedAt = formation.updatedAt;
    return dto;
  }
}
