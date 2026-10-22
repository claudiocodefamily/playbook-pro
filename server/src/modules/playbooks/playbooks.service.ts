import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { PlaybookSide } from '@playbook/shared';
import type { Connection, Model } from 'mongoose';
import { toMongoUpdate, withoutNullish } from '../../common/utils/mongo-update.js';
import { Play } from '../plays/schemas/play.schema.js';
import type { CreatePlaybookDto } from './dto/create-playbook.dto.js';
import type { UpdatePlaybookDto } from './dto/update-playbook.dto.js';
import { Playbook, type PlaybookDocument } from './schemas/playbook.schema.js';

const PLAYBOOK_NOT_FOUND = 'Playbook no encontrado';

/** Todos los métodos filtran por `teamId` y ignoran los playbooks borrados. */
@Injectable()
export class PlaybooksService {
  constructor(
    @InjectModel(Playbook.name) private readonly playbookModel: Model<Playbook>,
    @InjectModel(Play.name) private readonly playModel: Model<Play>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  create(teamId: string, dto: CreatePlaybookDto): Promise<PlaybookDocument> {
    return this.playbookModel.create({ ...withoutNullish(dto), teamId });
  }

  findAll(teamId: string, side?: PlaybookSide): Promise<PlaybookDocument[]> {
    return this.playbookModel
      .find({ teamId, deletedAt: null, ...(side ? { side } : {}) })
      .sort({ side: 1, name: 1 })
      .exec();
  }

  async findOne(teamId: string, playbookId: string): Promise<PlaybookDocument> {
    const playbook = await this.playbookModel
      .findOne({ _id: playbookId, teamId, deletedAt: null })
      .exec();
    if (!playbook) {
      throw new NotFoundException(PLAYBOOK_NOT_FOUND);
    }
    return playbook;
  }

  /** Cuántas jugadas (no borradas) tiene cada playbook, en una sola consulta. */
  async countPlays(teamId: string, playbookIds: string[]): Promise<Map<string, number>> {
    const counts = await this.playModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { teamId, playbookId: { $in: playbookIds }, deletedAt: null } },
        { $group: { _id: '$playbookId', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(counts.map(({ _id, count }) => [_id, count]));
  }

  async update(
    teamId: string,
    playbookId: string,
    dto: UpdatePlaybookDto,
  ): Promise<PlaybookDocument> {
    const playbook = await this.playbookModel
      .findOneAndUpdate({ _id: playbookId, teamId, deletedAt: null }, toMongoUpdate(dto), {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
    if (!playbook) {
      throw new NotFoundException(PLAYBOOK_NOT_FOUND);
    }
    return playbook;
  }

  /**
   * Borrado lógico del playbook y de sus jugadas, en una transacción: o se ocultan
   * todos o ninguno. Todos llevan la misma fecha para poder restaurarlos juntos.
   */
  async remove(teamId: string, playbookId: string): Promise<void> {
    const deletedAt = new Date();
    await this.connection.transaction(async (session) => {
      const result = await this.playbookModel
        .updateOne({ _id: playbookId, teamId, deletedAt: null }, { $set: { deletedAt } })
        .session(session)
        .exec();
      if (result.modifiedCount === 0) {
        throw new NotFoundException(PLAYBOOK_NOT_FOUND);
      }
      await this.playModel
        .updateMany({ teamId, playbookId, deletedAt: null }, { $set: { deletedAt } })
        .session(session)
        .exec();
    });
  }
}
