import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { Public } from '../../common/decorators/public.decorator.js';
import { Membership, type TeamMembership } from '../../common/decorators/team-member.decorator.js';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import {
  AcceptInviteResponseDto,
  InvitePreviewResponseDto,
} from './dto/invite-preview-response.dto.js';
import {
  PlayerAccessResponseDto,
  PlayerInviteResponseDto,
} from './dto/player-access-response.dto.js';
import { TeamMeResponseDto } from './dto/team-me-response.dto.js';
import { INVITE_DAYS, PlayerAccountsService } from './player-accounts.service.js';

@ApiTags('player-accounts')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({ description: 'El equipo o el jugador no existen, o no eres del equipo' })
@ApiForbiddenResponse({ description: 'Solo los coaches del equipo pueden hacer esto' })
@Controller('teams/:teamId')
export class PlayerAccountsController {
  constructor(private readonly accounts: PlayerAccountsService) {}

  @Post('roster/:rosterPlayerId/invite')
  @ApiOperation({
    summary: `Invita a un jugador del roster a crear su cuenta (link de un solo uso, ${INVITE_DAYS} días)`,
    description: 'El token solo se ve en esta respuesta. Anula las invitaciones anteriores.',
  })
  @ApiCreatedResponse({ type: PlayerInviteResponseDto })
  @ApiConflictResponse({ description: 'Este jugador ya tiene cuenta en el equipo' })
  invite(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('rosterPlayerId', ParseUuidPipe) rosterPlayerId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PlayerInviteResponseDto> {
    return this.accounts.invite(teamId, rosterPlayerId, user.id);
  }

  @Get('player-accounts')
  @ApiOperation({ summary: 'Qué jugadores del roster tienen cuenta o invitación pendiente' })
  @ApiOkResponse({ type: [PlayerAccessResponseDto] })
  listAccess(@Param('teamId', ParseUuidPipe) teamId: string): Promise<PlayerAccessResponseDto[]> {
    return this.accounts.listAccess(teamId);
  }

  @Delete('player-accounts/:rosterPlayerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita el acceso de un jugador y anula su invitación pendiente' })
  @ApiNoContentResponse()
  removeAccess(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('rosterPlayerId', ParseUuidPipe) rosterPlayerId: string,
  ): Promise<void> {
    return this.accounts.removeAccess(teamId, rosterPlayerId);
  }

  @Get('me')
  @AllowPlayers()
  @ApiOperation({ summary: 'Mi rol en el equipo y, si soy jugador, mi ficha del roster' })
  @ApiOkResponse({ type: TeamMeResponseDto })
  me(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Membership() membership: TeamMembership,
  ): Promise<TeamMeResponseDto> {
    return this.accounts.me(teamId, membership);
  }
}

@ApiTags('player-accounts')
@ApiNotFoundResponse({ description: 'La invitación no existe, caducó o ya se usó' })
@Controller('invites/:token')
export class InvitesController {
  constructor(private readonly accounts: PlayerAccountsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Público: a qué equipo y como qué jugador invita el link' })
  @ApiOkResponse({ type: InvitePreviewResponseDto })
  preview(@Param('token') token: string): Promise<InvitePreviewResponseDto> {
    return this.accounts.preview(token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Acepta la invitación: entro al equipo como jugador' })
  @ApiOkResponse({ type: AcceptInviteResponseDto })
  @ApiConflictResponse({ description: 'Ya estás en el equipo, o el jugador ya tiene cuenta' })
  accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AcceptInviteResponseDto> {
    return this.accounts.accept(token, user.id);
  }
}
