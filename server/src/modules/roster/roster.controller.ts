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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { CreateRosterPlayerDto } from './dto/create-roster-player.dto.js';
import { ListRosterQueryDto } from './dto/list-roster-query.dto.js';
import { RosterPlayerResponseDto } from './dto/roster-player-response.dto.js';
import { UpdateRosterPlayerDto } from './dto/update-roster-player.dto.js';
import { RosterService } from './roster.service.js';

@ApiTags('roster')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({
  description: 'El equipo o el jugador no existen, o no eres coach del equipo',
})
@Controller('teams/:teamId/roster')
export class RosterController {
  constructor(private readonly roster: RosterService) {}

  @Post()
  @ApiOperation({ summary: 'Añade un jugador al roster del equipo' })
  @ApiCreatedResponse({ type: RosterPlayerResponseDto })
  async create(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: CreateRosterPlayerDto,
  ): Promise<RosterPlayerResponseDto> {
    return RosterPlayerResponseDto.from(await this.roster.create(teamId, dto));
  }

  @Get()
  @ApiOperation({ summary: 'Lista el roster del equipo, ordenado por dorsal' })
  @ApiOkResponse({ type: [RosterPlayerResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Query() query: ListRosterQueryDto,
  ): Promise<RosterPlayerResponseDto[]> {
    const players = await this.roster.findAll(teamId, query);
    return players.map((player) => RosterPlayerResponseDto.from(player));
  }

  @Get(':playerId')
  @ApiOperation({ summary: 'Devuelve un jugador del roster' })
  @ApiOkResponse({ type: RosterPlayerResponseDto })
  async findOne(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playerId', ParseUuidPipe) playerId: string,
  ): Promise<RosterPlayerResponseDto> {
    return RosterPlayerResponseDto.from(await this.roster.findOne(teamId, playerId));
  }

  @Patch(':playerId')
  @ApiOperation({ summary: 'Edita un jugador del roster' })
  @ApiOkResponse({ type: RosterPlayerResponseDto })
  async update(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playerId', ParseUuidPipe) playerId: string,
    @Body() dto: UpdateRosterPlayerDto,
  ): Promise<RosterPlayerResponseDto> {
    return RosterPlayerResponseDto.from(await this.roster.update(teamId, playerId, dto));
  }

  @Delete(':playerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra un jugador del roster' })
  @ApiNoContentResponse()
  remove(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playerId', ParseUuidPipe) playerId: string,
  ): Promise<void> {
    return this.roster.remove(teamId, playerId);
  }
}
