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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AllowPlayers } from '../../common/decorators/allow-players.decorator.js';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  isPlayer,
  Membership,
  type TeamMembership,
} from '../../common/decorators/team-member.decorator.js';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { CreateGamePlanDto } from './dto/create-game-plan.dto.js';
import { GamePlanResponseDto, GamePlanSummaryResponseDto } from './dto/game-plan-response.dto.js';
import { UpdateGamePlanDto } from './dto/update-game-plan.dto.js';
import { GamePlansService } from './game-plans.service.js';
import type { GamePlanDocument } from './schemas/game-plan.schema.js';

@ApiTags('game-plans')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({ description: 'El equipo o el game plan no existen, o no eres del equipo' })
@ApiForbiddenResponse({ description: 'Solo los coaches del equipo pueden hacer esto' })
@Controller('teams/:teamId/game-plans')
export class GamePlansController {
  constructor(private readonly gamePlans: GamePlansService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea el game plan de un partido',
    description:
      'Nace con las situaciones típicas (1st & 10, 3rd down, red zone...) y oculto a los jugadores.',
  })
  @ApiCreatedResponse({ type: GamePlanResponseDto })
  async create(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: CreateGamePlanDto,
    @CurrentUser() user: AuthUser,
  ): Promise<GamePlanResponseDto> {
    return this.full(teamId, await this.gamePlans.create(teamId, user.id, dto), false);
  }

  @Get()
  @AllowPlayers()
  @ApiOperation({
    summary: 'Lista los game plans del equipo, los partidos más recientes primero',
    description: 'Un jugador solo recibe los publicados.',
  })
  @ApiOkResponse({ type: [GamePlanSummaryResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Membership() membership: TeamMembership,
  ): Promise<GamePlanSummaryResponseDto[]> {
    const visibility = { playersOnly: isPlayer(membership) };
    const plans = await this.gamePlans.findAll(teamId, visibility);
    const plays = await this.gamePlans.plays(teamId, plans, visibility);
    const known = new Set(plays.map((play) => play.id));
    return plans.map((plan) => GamePlanSummaryResponseDto.from(plan, known));
  }

  @Get(':planId')
  @AllowPlayers()
  @ApiOperation({ summary: 'Devuelve un game plan con sus situaciones y jugadas' })
  @ApiOkResponse({ type: GamePlanResponseDto })
  async findOne(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('planId', ParseUuidPipe) planId: string,
    @Membership() membership: TeamMembership,
  ): Promise<GamePlanResponseDto> {
    const player = isPlayer(membership);
    const plan = await this.gamePlans.findOne(teamId, planId, { playersOnly: player });
    return this.full(teamId, plan, player);
  }

  @Patch(':planId')
  @ApiOperation({
    summary: 'Cambia el rival, la fecha, las situaciones y sus jugadas, o lo publica',
  })
  @ApiOkResponse({ type: GamePlanResponseDto })
  @ApiBadRequestResponse({ description: 'Alguna jugada no existe o no es del equipo' })
  async update(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('planId', ParseUuidPipe) planId: string,
    @Body() dto: UpdateGamePlanDto,
  ): Promise<GamePlanResponseDto> {
    return this.full(teamId, await this.gamePlans.update(teamId, planId, dto), false);
  }

  @Delete(':planId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra el game plan (las jugadas no se tocan)' })
  @ApiNoContentResponse()
  remove(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('planId', ParseUuidPipe) planId: string,
  ): Promise<void> {
    return this.gamePlans.remove(teamId, planId);
  }

  private async full(
    teamId: string,
    plan: GamePlanDocument,
    playersOnly: boolean,
  ): Promise<GamePlanResponseDto> {
    const plays = await this.gamePlans.plays(teamId, [plan], { playersOnly });
    return GamePlanResponseDto.fromPlan(plan, plays);
  }
}
