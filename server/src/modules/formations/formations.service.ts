import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { PlaybookSide } from '@playbook/shared';
import type { Model } from 'mongoose';
import { isDuplicateKeyError } from '../../common/utils/mongo-errors.js';
import { toMongoUpdate } from '../../common/utils/mongo-update.js';
import type { CreateFormationDto } from './dto/create-formation.dto.js';
import type { UpdateFormationDto } from './dto/update-formation.dto.js';
import { Formation, type FormationDocument } from './schemas/formation.schema.js';

const FORMATION_NOT_FOUND = 'Formación no encontrada';
const DUPLICATE_NAME = 'El equipo ya tiene una formación con ese nombre en esa unidad';

/**
 * Un equipo ve sus formaciones y las globales (`teamId: null`), pero solo puede
 * modificar las suyas: los updates y borrados filtran siempre por su `teamId`.
 */
@Injectable()
export class FormationsService {
  constructor(@InjectModel(Formation.name) private readonly formationModel: Model<Formation>) {}

  async create(teamId: string, dto: CreateFormationDto): Promise<FormationDocument> {
    try {
      return await this.formationModel.create({ ...dto, teamId });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(DUPLICATE_NAME);
      }
      throw error;
    }
  }

  /** Primero las propias del equipo, después las globales; cada grupo por unidad y nombre. */
  async findAll(teamId: string, side?: PlaybookSide): Promise<FormationDocument[]> {
    const formations = await this.formationModel
      .find({ teamId: { $in: [teamId, null] }, ...(side ? { side } : {}) })
      .sort({ side: 1, name: 1 })
      .exec();
    return [
      ...formations.filter((formation) => formation.teamId !== null),
      ...formations.filter((formation) => formation.teamId === null),
    ];
  }

  /** Devuelve una formación del equipo o una global. */
  async findOne(teamId: string, formationId: string): Promise<FormationDocument> {
    const formation = await this.formationModel
      .findOne({ _id: formationId, teamId: { $in: [teamId, null] } })
      .exec();
    if (!formation) {
      throw new NotFoundException(FORMATION_NOT_FOUND);
    }
    return formation;
  }

  async update(
    teamId: string,
    formationId: string,
    dto: UpdateFormationDto,
  ): Promise<FormationDocument> {
    let formation: FormationDocument | null;
    try {
      formation = await this.formationModel
        .findOneAndUpdate({ _id: formationId, teamId }, toMongoUpdate(dto), {
          returnDocument: 'after',
          runValidators: true,
        })
        .exec();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(DUPLICATE_NAME);
      }
      throw error;
    }
    if (!formation) {
      throw await this.notEditable(formationId);
    }
    return formation;
  }

  /** Las jugadas que la usaban conservan sus jugadores: el diagram no depende de la formación. */
  async remove(teamId: string, formationId: string): Promise<void> {
    const result = await this.formationModel.deleteOne({ _id: formationId, teamId }).exec();
    if (result.deletedCount === 0) {
      throw await this.notEditable(formationId);
    }
  }

  /** Distingue "es una plantilla global" (409) de "no existe o es de otro equipo" (404). */
  private async notEditable(formationId: string): Promise<Error> {
    const isGlobal = await this.formationModel.exists({ _id: formationId, teamId: null });
    return isGlobal
      ? new ConflictException(
          'Las formaciones globales no se pueden modificar; crea una propia del equipo',
        )
      : new NotFoundException(FORMATION_NOT_FOUND);
  }
}
