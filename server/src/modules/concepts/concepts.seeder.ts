import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { newId } from '@playbook/shared';
import type { Model } from 'mongoose';
import { GLOBAL_CONCEPTS } from '../../database/seeds/concepts.seed.js';
import { Concept } from './schemas/concept.schema.js';

/**
 * Carga el glosario global al arrancar la API. Es idempotente: si un concepto ya existe,
 * actualiza su explicación y conserva el id, así las jugadas que lo enlazan no se rompen.
 */
@Injectable()
export class ConceptsSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConceptsSeeder.name);

  constructor(@InjectModel(Concept.name) private readonly conceptModel: Model<Concept>) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.conceptModel.bulkWrite(
      GLOBAL_CONCEPTS.map(({ name, side, explanation }) => ({
        updateOne: {
          filter: { teamId: null, name },
          update: { $set: { side, explanation }, $setOnInsert: { _id: newId() } },
          upsert: true,
        },
      })),
    );
    if (result.upsertedCount > 0) {
      this.logger.log(`Conceptos globales creados: ${result.upsertedCount}`);
    }
  }
}
