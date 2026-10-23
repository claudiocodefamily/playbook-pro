import { ApiProperty } from '@nestjs/swagger';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import type { PlaybookDocument } from '../schemas/playbook.schema.js';

export class PlaybookResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ example: 'Ofensiva 2026' })
  name!: string;

  @ApiProperty({ enum: PLAYBOOK_SIDES })
  side!: PlaybookSide;

  @ApiProperty()
  description!: string;

  @ApiProperty({ description: 'Si los jugadores con cuenta pueden verlo' })
  visibleToPlayers!: boolean;

  @ApiProperty({ description: 'Jugadas (no borradas) del playbook' })
  playCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(playbook: PlaybookDocument, playCount: number): PlaybookResponseDto {
    const dto = new PlaybookResponseDto();
    dto.id = playbook._id;
    dto.teamId = playbook.teamId;
    dto.name = playbook.name;
    dto.side = playbook.side;
    dto.description = playbook.description;
    dto.visibleToPlayers = playbook.visibleToPlayers;
    dto.playCount = playCount;
    dto.createdAt = playbook.createdAt;
    dto.updatedAt = playbook.updatedAt;
    return dto;
  }
}
