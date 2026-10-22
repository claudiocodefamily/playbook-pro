import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  /** Lo usa `TeamAccessGuard`: es la comprobación de aislamiento entre equipos. */
  async isMember(teamId: string, userId: string): Promise<boolean> {
    return (await this.teamModel.exists({ _id: teamId, 'members.userId': userId })) !== null;
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

    return team.members.flatMap((member) => {
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
      await this.findOne(teamId);
      throw new ConflictException('Ese usuario ya es coach del equipo');
    }
    return this.listMembers(teamId);
  }

  /** Quita a un coach. Un equipo nunca puede quedarse sin coaches. */
  async removeMember(teamId: string, userId: string): Promise<void> {
    // "members.1" existe solo si hay al menos dos miembros: así nunca se quita al último,
    // ni siquiera si dos coaches se quitan a la vez.
    const result = await this.teamModel
      .updateOne(
        { _id: teamId, 'members.userId': userId, 'members.1': { $exists: true } },
        { $pull: { members: { userId } } },
      )
      .exec();
    if (result.modifiedCount > 0) {
      return;
    }

    const team = await this.findOne(teamId);
    if (!team.members.some((member) => member.userId === userId)) {
      throw new NotFoundException('Ese usuario no es coach del equipo');
    }
    throw new ConflictException('No se puede quitar al último coach del equipo');
  }
}
