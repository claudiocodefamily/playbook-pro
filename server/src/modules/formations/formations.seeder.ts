import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { newId } from '@playbook/shared';
import type { Model } from 'mongoose';
import { GLOBAL_FORMATIONS } from '../../database/seeds/formations.seed.js';
import { Formation } from './schemas/formation.schema.js';

/**
 * Carga las formaciones globales al arrancar la API. Es idempotente: si ya existen,
 * solo actualiza sus jugadores y conserva el id, así las jugadas que las usan no se rompen.
 */
@Injectable()
export class FormationsSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(FormationsSeeder.name);

  constructor(@InjectModel(Formation.name) private readonly formationModel: Model<Formation>) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.formationModel.bulkWrite(
      GLOBAL_FORMATIONS.map(({ name, side, players }) => ({
        updateOne: {
          filter: { teamId: null, side, name },
          update: { $set: { players }, $setOnInsert: { _id: newId() } },
          upsert: true,
        },
      })),
    );
    if (result.upsertedCount > 0) {
      this.logger.log(`Formaciones globales creadas: ${result.upsertedCount}`);
    }
  }
}
