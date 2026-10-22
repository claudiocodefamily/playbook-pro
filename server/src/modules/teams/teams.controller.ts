import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { AddTeamMemberDto } from './dto/add-team-member.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { TeamMemberResponseDto, TeamResponseDto } from './dto/team-response.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { TeamsService } from './teams.service.js';

@ApiTags('teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un equipo; quien lo crea queda como su primer coach' })
  @ApiCreatedResponse({ type: TeamResponseDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    return TeamResponseDto.from(await this.teams.create(user.id, dto));
  }

  @Get()
  @ApiOperation({ summary: 'Lista los equipos de los que soy coach' })
  @ApiOkResponse({ type: [TeamResponseDto] })
  async findAll(@CurrentUser() user: AuthUser): Promise<TeamResponseDto[]> {
    const teams = await this.teams.findAllForUser(user.id);
    return teams.map((team) => TeamResponseDto.from(team));
  }

  @Get(':teamId')
  @UseGuards(TeamAccessGuard)
  @ApiOperation({ summary: 'Devuelve un equipo' })
  @ApiOkResponse({ type: TeamResponseDto })
  @ApiNotFoundResponse({ description: 'El equipo no existe o no eres su coach' })
  async findOne(@Param('teamId', ParseUuidPipe) teamId: string): Promise<TeamResponseDto> {
    return TeamResponseDto.from(await this.teams.findOne(teamId));
  }

  @Patch(':teamId')
  @UseGuards(TeamAccessGuard)
  @ApiOperation({ summary: 'Edita el nombre, el logo o el reglamento del equipo' })
  @ApiOkResponse({ type: TeamResponseDto })
  @ApiNotFoundResponse({ description: 'El equipo no existe o no eres su coach' })
  async update(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    return TeamResponseDto.from(await this.teams.update(teamId, dto));
  }

  @Get(':teamId/members')
  @UseGuards(TeamAccessGuard)
  @ApiOperation({ summary: 'Lista los coaches del equipo' })
  @ApiOkResponse({ type: [TeamMemberResponseDto] })
  listMembers(@Param('teamId', ParseUuidPipe) teamId: string): Promise<TeamMemberResponseDto[]> {
    return this.teams.listMembers(teamId);
  }

  @Post(':teamId/members')
  @UseGuards(TeamAccessGuard)
  @ApiOperation({ summary: 'Añade como coach a un usuario ya registrado, por su email' })
  @ApiCreatedResponse({ type: [TeamMemberResponseDto] })
  @ApiNotFoundResponse({ description: 'No hay ninguna cuenta con ese email' })
  @ApiConflictResponse({ description: 'Ese usuario ya es coach del equipo' })
  addMember(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: AddTeamMemberDto,
  ): Promise<TeamMemberResponseDto[]> {
    return this.teams.addMember(teamId, dto.email);
  }

  @Delete(':teamId/members/:userId')
  @UseGuards(TeamAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita a un coach del equipo (nunca al último)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Ese usuario no es coach del equipo' })
  @ApiConflictResponse({ description: 'No se puede quitar al último coach del equipo' })
  removeMember(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('userId', ParseUuidPipe) userId: string,
  ): Promise<void> {
    return this.teams.removeMember(teamId, userId);
  }
}
