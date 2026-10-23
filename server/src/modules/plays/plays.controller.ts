import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
import { AllowPlayers } from '../../common/decorators/allow-players.decorator.js';
import {
  isPlayer,
  Membership,
  type TeamMembership,
} from '../../common/decorators/team-member.decorator.js';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { CreatePlayDto } from './dto/create-play.dto.js';
import { DuplicatePlayDto } from './dto/duplicate-play.dto.js';
import { ListPlaysQueryDto } from './dto/list-plays-query.dto.js';
import { PlayResponseDto, PlaySummaryResponseDto } from './dto/play-response.dto.js';
import {
  PlayVersionResponseDto,
  PlayVersionSummaryResponseDto,
} from './dto/play-version-response.dto.js';
import { UpdatePlayDto } from './dto/update-play.dto.js';
import { PlaysService } from './plays.service.js';

/** Jugadas dentro de un playbook: listar y crear. */
@ApiTags('plays')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({
  description: 'El equipo o el playbook no existen, o no eres del equipo',
})
@Controller('teams/:teamId/playbooks/:playbookId/plays')
export class PlaybookPlaysController {
  constructor(private readonly plays: PlaysService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea una jugada vacía, a partir de una formación o con un diagram ya hecho',
  })
  @ApiCreatedResponse({ type: PlayResponseDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
    @Body() dto: CreatePlayDto,
  ): Promise<PlayResponseDto> {
    return PlayResponseDto.from(await this.plays.create(teamId, playbookId, user.id, dto));
  }

  @Get()
  @AllowPlayers()
  @ApiOperation({ summary: 'Lista las jugadas del playbook, con filtro por etiqueta o texto' })
  @ApiOkResponse({ type: [PlaySummaryResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
    @Query() query: ListPlaysQueryDto,
    @Membership() membership: TeamMembership,
  ): Promise<PlaySummaryResponseDto[]> {
    const plays = await this.plays.findAll(teamId, playbookId, query, {
      playersOnly: isPlayer(membership),
    });
    return plays.map((play) => PlaySummaryResponseDto.from(play));
  }
}

/** Una jugada concreta: leer, guardar, borrar, duplicar y su historial de versiones. */
@ApiTags('plays')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({
  description: 'El equipo o la jugada no existen, o no eres del equipo',
})
@Controller('teams/:teamId/plays/:playId')
export class PlaysController {
  constructor(private readonly plays: PlaysService) {}

  @Get()
  @AllowPlayers()
  @ApiOperation({ summary: 'Devuelve una jugada con su diagram' })
  @ApiOkResponse({ type: PlayResponseDto })
  async findOne(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playId', ParseUuidPipe) playId: string,
    @Membership() membership: TeamMembership,
  ): Promise<PlayResponseDto> {
    const play = await this.plays.findOne(teamId, playId, { playersOnly: isPlayer(membership) });
    return PlayResponseDto.from(play);
  }

  @Patch()
  @ApiOperation({
    summary: 'Guarda cambios (autoguardado o "Guardar versión" con saveVersion: true)',
  })
  @ApiOkResponse({ type: PlayResponseDto })
  @ApiConflictResponse({ description: 'Otro coach guardó la jugada después de que la abrieras' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playId', ParseUuidPipe) playId: string,
    @Body() dto: UpdatePlayDto,
  ): Promise<PlayResponseDto> {
    return PlayResponseDto.from(await this.plays.update(teamId, playId, user.id, dto));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra una jugada (borrado lógico)' })
  @ApiNoContentResponse()
  remove(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playId', ParseUuidPipe) playId: string,
  ): Promise<void> {
    return this.plays.remove(teamId, playId);
  }

  @Post('duplicate')
  @ApiOperation({ summary: 'Duplica la jugada en el mismo playbook o en otro del equipo' })
  @ApiCreatedResponse({ type: PlayResponseDto })
  async duplicate(
    @CurrentUser() user: AuthUser,
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playId', ParseUuidPipe) playId: string,
    @Body() dto: DuplicatePlayDto,
  ): Promise<PlayResponseDto> {
    return PlayResponseDto.from(await this.plays.duplicate(teamId, playId, user.id, dto));
  }

  @Get('versions')
  @ApiOperation({ summary: 'Historial de versiones guardadas, la más reciente primero' })
  @ApiOkResponse({ type: [PlayVersionSummaryResponseDto] })
  async listVersions(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playId', ParseUuidPipe) playId: string,
  ): Promise<PlayVersionSummaryResponseDto[]> {
    const versions = await this.plays.listVersions(teamId, playId);
    return versions.map((version) => PlayVersionSummaryResponseDto.from(version));
  }

  @Get('versions/:version')
  @ApiOperation({ summary: 'Devuelve una versión del historial con su diagram' })
  @ApiOkResponse({ type: PlayVersionResponseDto })
  async findVersion(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playId', ParseUuidPipe) playId: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<PlayVersionResponseDto> {
    return PlayVersionResponseDto.from(await this.plays.findVersion(teamId, playId, version));
  }
}
