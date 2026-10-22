import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RULESETS, type Ruleset, TEAM_ROLES, type TeamRole } from '@playbook/shared';
import type { UserDocument } from '../../users/schemas/user.schema.js';
import type { TeamDocument, TeamMember } from '../schemas/team.schema.js';

/** Un coach del equipo, con los datos de su cuenta para poder mostrarlo en pantalla. */
export class TeamMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'Coach Taylor' })
  name!: string;

  @ApiProperty({ example: 'coach@equipo.com' })
  email!: string;

  @ApiProperty({ enum: TEAM_ROLES })
  role!: TeamRole;

  @ApiProperty()
  joinedAt!: Date;

  static from(member: TeamMember, user: UserDocument): TeamMemberResponseDto {
    const dto = new TeamMemberResponseDto();
    dto.userId = member.userId;
    dto.name = user.name;
    dto.email = user.email;
    dto.role = member.role;
    dto.joinedAt = member.joinedAt;
    return dto;
  }
}

export class TeamResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Lobos de Monterrey' })
  name!: string;

  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiProperty({ enum: RULESETS })
  ruleset!: Ruleset;

  @ApiProperty({ example: 2, description: 'Número de coaches del equipo' })
  memberCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(team: TeamDocument): TeamResponseDto {
    const dto = new TeamResponseDto();
    dto.id = team._id;
    dto.name = team.name;
    dto.logoUrl = team.logoUrl;
    dto.ruleset = team.ruleset;
    dto.memberCount = team.members.length;
    dto.createdAt = team.createdAt;
    dto.updatedAt = team.updatedAt;
    return dto;
  }
}
