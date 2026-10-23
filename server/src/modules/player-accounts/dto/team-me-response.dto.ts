import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { POSITIONS, type Position, TEAM_ROLES, type TeamRole } from '@playbook/shared';

export class MyRosterPlayerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name!: string;

  @ApiProperty({ example: 12 })
  number!: number;

  @ApiProperty({ enum: POSITIONS, isArray: true })
  positions!: Position[];
}

/** Quién soy en el equipo: el rol y, si soy jugador, mi ficha del roster. */
export class TeamMeResponseDto {
  @ApiProperty({ enum: TEAM_ROLES })
  role!: TeamRole;

  @ApiPropertyOptional({ type: MyRosterPlayerDto, nullable: true })
  rosterPlayer!: MyRosterPlayerDto | null;
}
