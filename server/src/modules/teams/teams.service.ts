import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { TeamMembership } from '../../common/decorators/team-member.decorator.js';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { toMongoUpdate, withoutNullish } from '../../common/utils/mongo-update.js';
import { UsersService } from '../users/users.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import { TeamMemberResponseDto } from './dto/team-response.dto.js';
import type { UpdateTeamDto } from './dto/update-team.dto.js';
import { Team, type TeamDocument } from './schemas/team.schema.js';

const TEAM_NOT_FOUND = 'Equipo no encontrado';

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
    private readonly users: UsersService,
  ) {}

  /** Quien crea el equipo queda como su primer coach. */
  create(userId: string, dto: CreateTeamDto): Promise<TeamDocument> {
    return this.teamModel.create({
      ...withoutNullish(dto),
      members: [{ userId, role: 'COACH' }],
    });
  }

  findAllForUser(userId: string): Promise<TeamDocument[]> {
    return this.teamModel.find({ 'members.userId': userId }).sort({ name: 1 }).exec();
  }

  /**
   * Lo usa `TeamAccessGuard`: es la comprobación de aislamiento entre equipos. Devuelve el
   * rol del usuario en el equipo, o null si no es miembro.
   */
  async membership(teamId: string, userId: string): Promise<TeamMembership | null> {
    const team = await this.teamModel
      .findOne({ _id: teamId, 'members.userId': userId }, { 'members.$': 1 })
      .lean()
      .exec();
    const member = team?.members[0];
    return member ? { role: member.role, rosterPlayerId: member.rosterPlayerId ?? null } : null;
  }

  async findOne(teamId: string): Promise<TeamDocument> {
    const team = await this.teamModel.findById(teamId).exec();
    if (!team) {
      throw new NotFoundException(TEAM_NOT_FOUND);
    }
    return team;
  }

  async update(teamId: string, dto: UpdateTeamDto): Promise<TeamDocument> {
    const team = await this.teamModel
      .findByIdAndUpdate(teamId, toMongoUpdate(dto), {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
    if (!team) {
      throw new NotFoundException(TEAM_NOT_FOUND);
    }
    return team;
  }

  async listMembers(teamId: string): Promise<TeamMemberResponseDto[]> {
    const team = await this.findOne(teamId);
    const users = await this.users.findByIds(team.members.map((member) => member.userId));
    const usersById = new Map(users.map((user) => [user._id, user]));

    // Los jugadores con cuenta se gestionan desde el roster, no en la lista de coaches.
    return team.members.flatMap((member) => {
      if (member.role !== 'COACH') return [];
      const user = usersById.get(member.userId);
      return user ? [TeamMemberResponseDto.from(member, user)] : [];
    });
  }

  /** Añade como coach a un usuario ya registrado, buscándolo por su email. */
  async addMember(teamId: string, email: string): Promise<TeamMemberResponseDto[]> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new NotFoundException('No hay ninguna cuenta con ese email');
    }

    // El filtro "$ne" hace la comprobación y el alta en una sola operación: no puede duplicarse.
    const result = await this.teamModel
      .updateOne(
        { _id: teamId, 'members.userId': { $ne: user._id } },
        { $push: { members: { userId: user._id, role: 'COACH', joinedAt: new Date() } } },
      )
      .exec();
    if (result.modifiedCount === 0) {
      const team = await this.findOne(teamId);
      const existing = team.members.find((member) => member.userId === user._id);
      throw new ConflictException(
        existing?.role === 'PLAYER'
          ? 'Ese usuario ya está en el equipo como jugador'
          : 'Ese usuario ya es coach del equipo',
      );
    }
    return this.listMembers(teamId);
  }

  /** Quita a un coach. Un equipo nunca puede quedarse sin coaches. */
  async removeMember(teamId: string, userId: string): Promise<void> {
    // Solo si queda otro coach: la comprobación y el borrado van en una sola operación, así
    // nunca se quita al último, ni siquiera si dos coaches se quitan a la vez.
    const result = await this.teamModel
      .updateOne(
        {
          _id: teamId,
          members: { $elemMatch: { userId, role: 'COACH' } },
          $and: [{ members: { $elemMatch: { userId: { $ne: userId }, role: 'COACH' } } }],
        },
        { $pull: { members: { userId } } },
      )
      .exec();
    if (result.modifiedCount > 0) {
      return;
    }

    const team = await this.findOne(teamId);
    if (!team.members.some((member) => member.userId === userId && member.role === 'COACH')) {
      throw new NotFoundException('Ese usuario no es coach del equipo');
    }
    throw new ConflictException('No se puede quitar al último coach del equipo');
  }

  /**
   * Da de alta a un jugador con cuenta, unido a su ficha del roster. Falla si el usuario ya
   * es del equipo o si esa ficha ya tiene cuenta.
   */
  async addPlayer(teamId: string, userId: string, rosterPlayerId: string): Promise<boolean> {
    const result = await this.teamModel
      .updateOne(
        {
          _id: teamId,
          'members.userId': { $ne: userId },
          'members.rosterPlayerId': { $ne: rosterPlayerId },
        },
        { $push: { members: { userId, role: 'PLAYER', rosterPlayerId, joinedAt: new Date() } } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  /** Quita el acceso del jugador unido a esa ficha del roster. Devuelve false si no había. */
  async removePlayer(teamId: string, rosterPlayerId: string): Promise<boolean> {
    // La condición va en el filtro: con timestamps, updatedAt cambia siempre y modifiedCount
    // no dice si se quitó a alguien.
    const result = await this.teamModel
      .updateOne(
        { _id: teamId, members: { $elemMatch: { role: 'PLAYER', rosterPlayerId } } },
        { $pull: { members: { role: 'PLAYER', rosterPlayerId } } },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  /** Jugadores con cuenta del equipo, con los datos de su cuenta. */
  async listPlayers(
    teamId: string,
  ): Promise<{ rosterPlayerId: string; member: TeamMemberResponseDto }[]> {
    const team = await this.findOne(teamId);
    const players = team.members.filter((member) => member.role === 'PLAYER');
    const users = await this.users.findByIds(players.map((member) => member.userId));
    const usersById = new Map(users.map((user) => [user._id, user]));
    return players.flatMap((member) => {
      const user = usersById.get(member.userId);
      return user && member.rosterPlayerId
        ? [
            {
              rosterPlayerId: member.rosterPlayerId,
              member: TeamMemberResponseDto.from(member, user),
            },
          ]
        : [];
    });
  }
}
