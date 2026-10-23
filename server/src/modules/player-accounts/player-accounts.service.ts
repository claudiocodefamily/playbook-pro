import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { TeamMembership } from '../../common/decorators/team-member.decorator.js';
import {
  hashSecretToken,
  isSecretTokenShape,
  newSecretToken,
} from '../../common/utils/secret-token.js';
import { RosterService } from '../roster/roster.service.js';
import { TeamsService } from '../teams/teams.service.js';
import type {
  AcceptInviteResponseDto,
  InvitePreviewResponseDto,
} from './dto/invite-preview-response.dto.js';
import type {
  PlayerAccessResponseDto,
  PlayerInviteResponseDto,
} from './dto/player-access-response.dto.js';
import type { TeamMeResponseDto } from './dto/team-me-response.dto.js';
import { PlayerInvite, type PlayerInviteDocument } from './schemas/player-invite.schema.js';

/** Lo que dura una invitación: tiempo de sobra para que el jugador la abra. */
export const INVITE_DAYS = 14;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
// El mismo mensaje para una invitación inventada, caducada o ya usada: no da pistas.
const INVITE_NOT_FOUND = 'Esta invitación no existe, caducó o ya se usó';

/**
 * Cuentas de jugadores: el coach invita a un jugador del roster con un link de un solo uso
 * y el jugador entra al equipo con el rol PLAYER, unido a su ficha.
 */
@Injectable()
export class PlayerAccountsService {
  constructor(
    @InjectModel(PlayerInvite.name) private readonly inviteModel: Model<PlayerInvite>,
    private readonly teams: TeamsService,
    private readonly roster: RosterService,
  ) {}

  /** Crea la invitación y anula las anteriores sin usar de ese jugador: solo vale la última. */
  async invite(
    teamId: string,
    rosterPlayerId: string,
    createdBy: string,
  ): Promise<PlayerInviteResponseDto> {
    await this.roster.findOne(teamId, rosterPlayerId);
    const players = await this.teams.listPlayers(teamId);
    if (players.some((player) => player.rosterPlayerId === rosterPlayerId)) {
      throw new ConflictException('Este jugador ya tiene cuenta en el equipo');
    }

    await this.inviteModel.deleteMany({ teamId, rosterPlayerId, usedAt: null }).exec();
    const token = newSecretToken();
    const invite = await this.inviteModel.create({
      teamId,
      rosterPlayerId,
      tokenHash: hashSecretToken(token),
      expiresAt: new Date(Date.now() + INVITE_DAYS * DAY_IN_MS),
      createdBy,
    });
    return { rosterPlayerId, token, expiresAt: invite.expiresAt };
  }

  /** Quién del roster tiene cuenta y quién tiene una invitación pendiente. */
  async listAccess(teamId: string): Promise<PlayerAccessResponseDto[]> {
    const [players, invites] = await Promise.all([
      this.teams.listPlayers(teamId),
      this.inviteModel
        .find({ teamId, usedAt: null, expiresAt: { $gt: new Date() } })
        .lean()
        .exec(),
    ]);
    const byRoster = new Map<string, PlayerAccessResponseDto>();
    const entry = (rosterPlayerId: string): PlayerAccessResponseDto => {
      const existing = byRoster.get(rosterPlayerId);
      if (existing) return existing;
      const created = { rosterPlayerId, account: null, inviteExpiresAt: null };
      byRoster.set(rosterPlayerId, created);
      return created;
    };
    for (const { rosterPlayerId, member } of players) {
      const { userId, name, email, joinedAt } = member;
      entry(rosterPlayerId).account = { userId, name, email, joinedAt };
    }
    for (const invite of invites) {
      entry(invite.rosterPlayerId).inviteExpiresAt = invite.expiresAt;
    }
    return [...byRoster.values()];
  }

  /** Quita la cuenta del jugador del equipo y anula sus invitaciones pendientes. */
  async removeAccess(teamId: string, rosterPlayerId: string): Promise<void> {
    const [removed, invites] = await Promise.all([
      this.teams.removePlayer(teamId, rosterPlayerId),
      this.inviteModel.deleteMany({ teamId, rosterPlayerId, usedAt: null }).exec(),
    ]);
    if (!removed && invites.deletedCount === 0) {
      throw new NotFoundException('Este jugador no tiene cuenta ni invitación pendiente');
    }
  }

  async me(teamId: string, membership: TeamMembership): Promise<TeamMeResponseDto> {
    if (membership.role !== 'PLAYER' || !membership.rosterPlayerId) {
      return { role: membership.role, rosterPlayer: null };
    }
    const player = await this.roster.findOne(teamId, membership.rosterPlayerId).catch(() => null);
    return {
      role: membership.role,
      rosterPlayer: player && {
        id: player._id,
        name: player.name,
        number: player.number,
        positions: [...player.positions],
      },
    };
  }

  /** Público: a qué equipo y como qué jugador invita el link. */
  async preview(token: string): Promise<InvitePreviewResponseDto> {
    const invite = await this.findUsable(token);
    const [team, player] = await Promise.all([
      this.teams.findOne(invite.teamId),
      this.roster.findOne(invite.teamId, invite.rosterPlayerId),
    ]).catch(() => {
      throw new NotFoundException(INVITE_NOT_FOUND);
    });
    return {
      teamName: team.name,
      playerName: player.name,
      number: player.number,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * El usuario con sesión entra al equipo como jugador. La invitación se marca como usada
   * en la misma operación que la comprueba, así dos personas no pueden usar el mismo link.
   */
  async accept(token: string, userId: string): Promise<AcceptInviteResponseDto> {
    const invite = await this.findUsable(token);
    const { teamId, rosterPlayerId } = invite;
    await this.roster.findOne(teamId, rosterPlayerId).catch(() => {
      throw new NotFoundException(INVITE_NOT_FOUND);
    });
    const current = await this.teams.membership(teamId, userId);
    if (current) {
      throw new ConflictException(
        current.role === 'COACH' ? 'Ya eres coach de este equipo' : 'Ya estás en este equipo',
      );
    }

    const claimed = await this.inviteModel
      .findOneAndUpdate(
        { _id: invite._id, usedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
      )
      .exec();
    if (!claimed) {
      throw new NotFoundException(INVITE_NOT_FOUND);
    }
    if (!(await this.teams.addPlayer(teamId, userId, rosterPlayerId))) {
      // Otro usuario se unió con esta ficha mientras tanto: la invitación vuelve a valer.
      await this.inviteModel.updateOne({ _id: invite._id }, { $set: { usedAt: null } }).exec();
      throw new ConflictException('Este jugador ya tiene cuenta en el equipo');
    }
    return { teamId };
  }

  private async findUsable(token: string): Promise<PlayerInviteDocument> {
    if (!isSecretTokenShape(token)) throw new NotFoundException(INVITE_NOT_FOUND);
    const invite = await this.inviteModel
      .findOne({ tokenHash: hashSecretToken(token), usedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
    if (!invite) throw new NotFoundException(INVITE_NOT_FOUND);
    return invite;
  }
}
