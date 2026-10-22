import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { toMongoUpdate, withoutNullish } from '../../common/utils/mongo-update.js';
import type { CreateRosterPlayerDto } from './dto/create-roster-player.dto.js';
import type { ListRosterQueryDto } from './dto/list-roster-query.dto.js';
import type { UpdateRosterPlayerDto } from './dto/update-roster-player.dto.js';
import { RosterPlayer, type RosterPlayerDocument } from './schemas/roster-player.schema.js';

const PLAYER_NOT_FOUND = 'Jugador no encontrado';

/** Todos los métodos reciben `teamId` y lo incluyen en el filtro: un equipo nunca ve el roster de otro. */
@Injectable()
export class RosterService {
  constructor(@InjectModel(RosterPlayer.name) private readonly playerModel: Model<RosterPlayer>) {}

  create(teamId: string, dto: CreateRosterPlayerDto): Promise<RosterPlayerDocument> {
    return this.playerModel.create({ ...withoutNullish(dto), teamId });
  }

  findAll(teamId: string, query: ListRosterQueryDto): Promise<RosterPlayerDocument[]> {
    return this.playerModel
      .find({ teamId, ...(query.active === undefined ? {} : { active: query.active }) })
      .sort({ number: 1, name: 1 })
      .exec();
  }

  async findOne(teamId: string, playerId: string): Promise<RosterPlayerDocument> {
    const player = await this.playerModel.findOne({ _id: playerId, teamId }).exec();
    if (!player) {
      throw new NotFoundException(PLAYER_NOT_FOUND);
    }
    return player;
  }

  async update(
    teamId: string,
    playerId: string,
    dto: UpdateRosterPlayerDto,
  ): Promise<RosterPlayerDocument> {
    const player = await this.playerModel
      .findOneAndUpdate({ _id: playerId, teamId }, toMongoUpdate(dto), {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
    if (!player) {
      throw new NotFoundException(PLAYER_NOT_FOUND);
    }
    return player;
  }

  async remove(teamId: string, playerId: string): Promise<void> {
    const result = await this.playerModel.deleteOne({ _id: playerId, teamId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(PLAYER_NOT_FOUND);
    }
  }
}
