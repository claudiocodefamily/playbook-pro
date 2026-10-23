import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { PlaybookSide } from '@playbook/shared';
import type { Model } from 'mongoose';
import { isDuplicateKeyError } from '../../common/utils/mongo-errors.js';
import { toMongoUpdate } from '../../common/utils/mongo-update.js';
import { Play, type PlayDocument } from '../plays/schemas/play.schema.js';
import type { CreateConceptDto } from './dto/create-concept.dto.js';
import type { UpdateConceptDto } from './dto/update-concept.dto.js';
import { Concept, type ConceptDocument } from './schemas/concept.schema.js';

const CONCEPT_NOT_FOUND = 'Concepto no encontrado';
const DUPLICATE_NAME = 'El equipo ya tiene un concepto con ese nombre';

/**
 * Glosario del equipo. Igual que las formaciones: un equipo ve sus conceptos y los globales
 * (`teamId: null`), pero solo modifica los suyos.
 */
@Injectable()
export class ConceptsService {
  constructor(
    @InjectModel(Concept.name) private readonly conceptModel: Model<Concept>,
    @InjectModel(Play.name) private readonly playModel: Model<Play>,
  ) {}

  async create(teamId: string, dto: CreateConceptDto): Promise<ConceptDocument> {
    try {
      return await this.conceptModel.create({ ...dto, teamId });
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new ConflictException(DUPLICATE_NAME);
      throw error;
    }
  }

  /** Por unidad y nombre; los del equipo y los globales juntos, como un único glosario. */
  async findAll(teamId: string, side?: PlaybookSide): Promise<ConceptDocument[]> {
    return this.conceptModel
      .find({ teamId: { $in: [teamId, null] }, ...(side ? { side } : {}) })
      .collation({ locale: 'es', strength: 2 })
      .sort({ side: 1, name: 1 })
      .exec();
  }

  async findOne(teamId: string, conceptId: string): Promise<ConceptDocument> {
    const concept = await this.conceptModel
      .findOne({ _id: conceptId, teamId: { $in: [teamId, null] } })
      .exec();
    if (!concept) throw new NotFoundException(CONCEPT_NOT_FOUND);
    return concept;
  }

  /** Cuántas jugadas del equipo (no borradas) enseñan cada concepto. */
  async playCounts(teamId: string): Promise<Map<string, number>> {
    const rows = await this.playModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { teamId, deletedAt: null } },
        { $unwind: '$conceptIds' },
        { $group: { _id: '$conceptIds', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id, row.count]));
  }

  /** Jugadas del equipo que enseñan el concepto, sin el diagram. */
  async plays(teamId: string, conceptId: string): Promise<PlayDocument[]> {
    await this.findOne(teamId, conceptId);
    return this.playModel
      .find({ teamId, deletedAt: null, conceptIds: conceptId })
      .select({ diagram: 0 })
      .sort({ name: 1 })
      .exec();
  }

  /** Comprueba que el equipo ve todos esos conceptos (los suyos o globales). */
  async assertVisible(teamId: string, conceptIds: readonly string[]): Promise<void> {
    if (conceptIds.length === 0) return;
    const found = await this.conceptModel
      .countDocuments({ _id: { $in: conceptIds }, teamId: { $in: [teamId, null] } })
      .exec();
    if (found !== new Set(conceptIds).size) {
      throw new BadRequestException('Algún concepto no existe en el glosario del equipo');
    }
  }

  async update(teamId: string, conceptId: string, dto: UpdateConceptDto): Promise<ConceptDocument> {
    let concept: ConceptDocument | null;
    try {
      concept = await this.conceptModel
        .findOneAndUpdate({ _id: conceptId, teamId }, toMongoUpdate(dto), {
          returnDocument: 'after',
          runValidators: true,
        })
        .exec();
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new ConflictException(DUPLICATE_NAME);
      throw error;
    }
    if (!concept) throw await this.notEditable(conceptId);
    return concept;
  }

  /** Lo quita también de las jugadas del equipo que lo enlazaban. */
  async remove(teamId: string, conceptId: string): Promise<void> {
    const result = await this.conceptModel.deleteOne({ _id: conceptId, teamId }).exec();
    if (result.deletedCount === 0) throw await this.notEditable(conceptId);
    await this.playModel
      .updateMany({ teamId, conceptIds: conceptId }, { $pull: { conceptIds: conceptId } })
      .exec();
  }

  /** Distingue "es un concepto global" (409) de "no existe o es de otro equipo" (404). */
  private async notEditable(conceptId: string): Promise<Error> {
    const isGlobal = await this.conceptModel.exists({ _id: conceptId, teamId: null });
    return isGlobal
      ? new ConflictException(
          'Los conceptos globales no se pueden modificar; cópialo al equipo para cambiarlo',
        )
      : new NotFoundException(CONCEPT_NOT_FOUND);
  }
}
