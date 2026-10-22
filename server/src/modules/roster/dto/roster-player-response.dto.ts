import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { POSITIONS, type Position } from '@playbook/shared';
import type { RosterPlayerDocument } from '../schemas/roster-player.schema.js';

export class RosterPlayerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ example: 'Carlos Ramírez' })
  name!: string;

  @ApiProperty({ example: 12 })
  number!: number;

  @ApiProperty({ enum: POSITIONS, isArray: true })
  positions!: Position[];

  @ApiPropertyOptional()
  photoUrl?: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(player: RosterPlayerDocument): RosterPlayerResponseDto {
    const dto = new RosterPlayerResponseDto();
    dto.id = player._id;
    dto.teamId = player.teamId;
    dto.name = player.name;
    dto.number = player.number;
    dto.positions = [...player.positions];
    dto.photoUrl = player.photoUrl;
    dto.active = player.active;
    dto.createdAt = player.createdAt;
    dto.updatedAt = player.updatedAt;
    return dto;
  }
}
