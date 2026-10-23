import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  cloneDiagramWithNewIds,
  createDiagramFromFormation,
  createEmptyDiagram,
  migrateDiagram,
  PlayDiagramSchema,
  type PlayDiagram,
} from '@playbook/shared';
import type { ClientSession, Connection, Model } from 'mongoose';
import { ConceptsService } from '../concepts/concepts.service.js';
import { FormationsService } from '../formations/formations.service.js';
import { PlaybooksService } from '../playbooks/playbooks.service.js';
import type { CreatePlayDto } from './dto/create-play.dto.js';
import type { DuplicatePlayDto } from './dto/duplicate-play.dto.js';
import type { ListPlaysQueryDto } from './dto/list-plays-query.dto.js';
import type { UpdatePlayDto } from './dto/update-play.dto.js';
import { PlayVersion, type PlayVersionDocument } from './schemas/play-version.schema.js';
import { Play, type PlayDocument } from './schemas/play.schema.js';

const PLAY_NOT_FOUND = 'Jugada no encontrada';
const NAME_MAX_LENGTH = 120;

/** Versiones guardadas por jugada; al pasar de aquí se borran las más antiguas. */
export const MAX_VERSIONS_PER_PLAY = 50;

/** Todos los métodos filtran por `teamId` y por `deletedAt: null`. */
@Injectable()
export class PlaysService {
  constructor(
    @InjectModel(Play.name) private readonly playModel: Model<Play>,
    @InjectModel(PlayVersion.name) private readonly versionModel: Model<PlayVersion>,
    @InjectConnection() private readonly connection: Connection,
    private readonly playbooks: PlaybooksService,
    private readonly formations: FormationsService,
    private readonly concepts: ConceptsService,
  ) {}

  /**
   * Crea una jugada. Si no trae diagram pero sí formación, coloca a los jugadores
   * según la formación; si no trae ninguno de los dos, empieza con la cancha vacía.
   */
  async create(
    teamId: string,
    playbookId: string,
    userId: string,
    dto: CreatePlayDto,
  ): Promise<PlayDocument> {
    await this.playbooks.findOne(teamId, playbookId);
    await this.concepts.assertVisible(teamId, dto.conceptIds ?? []);

    let diagram: PlayDiagram = dto.diagram
      ? PlayDiagramSchema.parse(dto.diagram)
      : createEmptyDiagram();
    if (dto.formationId) {
      const formation = await this.formations.findOne(teamId, dto.formationId);
      if (!dto.diagram) {
        diagram = createDiagramFromFormation(formation.players, formation.side);
      }
    }

    return this.playModel.create({
      teamId,
      playbookId,
      name: dto.name,
      formationId: dto.formationId ?? null,
      tags: dto.tags ?? [],
      conceptIds: dto.conceptIds ?? [],
      diagram,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  /** Jugadas de un playbook, las editadas más recientemente primero. No incluye el diagram. */
  async findAll(
    teamId: string,
    playbookId: string,
    query: ListPlaysQueryDto,
  ): Promise<PlayDocument[]> {
    await this.playbooks.findOne(teamId, playbookId);
    return this.playModel
      .find({
        teamId,
        playbookId,
        deletedAt: null,
        ...(query.tag ? { tags: query.tag } : {}),
        ...(query.q ? { $text: { $search: query.q } } : {}),
      })
      .select({ diagram: 0 })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findOne(teamId: string, playId: string): Promise<PlayDocument> {
    const play = await this.playModel.findOne({ _id: playId, teamId, deletedAt: null }).exec();
    if (!play) {
      throw new NotFoundException(PLAY_NOT_FOUND);
    }
    return play;
  }

  /**
   * Guarda cambios con bloqueo optimista: solo se aplica si la jugada sigue en la `version`
   * que tenía el coach al abrirla. Con `saveVersion`, la jugada y su foto en el historial
   * se guardan en una transacción: o las dos o ninguna.
   */
  async update(
    teamId: string,
    playId: string,
    userId: string,
    dto: UpdatePlayDto,
  ): Promise<PlayDocument> {
    if (dto.playbookId) {
      await this.playbooks.findOne(teamId, dto.playbookId);
    }
    if (dto.formationId) {
      await this.formations.findOne(teamId, dto.formationId);
    }
    if (dto.conceptIds) {
      await this.concepts.assertVisible(teamId, dto.conceptIds);
    }

    const set: Partial<Play> = { updatedBy: userId };
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.playbookId !== undefined) set.playbookId = dto.playbookId;
    if (dto.formationId !== undefined) set.formationId = dto.formationId;
    if (dto.tags !== undefined) set.tags = dto.tags;
    if (dto.conceptIds !== undefined) set.conceptIds = dto.conceptIds;
    if (dto.diagram !== undefined) set.diagram = PlayDiagramSchema.parse(dto.diagram);

    const apply = async (session?: ClientSession): Promise<PlayDocument> => {
      const play = await this.playModel
        .findOneAndUpdate(
          { _id: playId, teamId, deletedAt: null, version: dto.version },
          { $set: set, $inc: { version: 1 } },
          { returnDocument: 'after', runValidators: true, session },
        )
        .exec();
      if (!play) {
        throw await this.updateFailure(teamId, playId);
      }
      if (session) {
        await this.saveVersion(play, userId, session);
      }
      return play;
    };

    return dto.saveVersion ? this.connection.transaction((session) => apply(session)) : apply();
  }

  /** Borrado lógico: la jugada deja de verse pero no se pierde. */
  async remove(teamId: string, playId: string): Promise<void> {
    const result = await this.playModel
      .updateOne({ _id: playId, teamId, deletedAt: null }, { $set: { deletedAt: new Date() } })
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException(PLAY_NOT_FOUND);
    }
  }

  /** Copia la jugada (en su playbook o en otro del equipo). La copia empieza sin historial. */
  async duplicate(
    teamId: string,
    playId: string,
    userId: string,
    dto: DuplicatePlayDto,
  ): Promise<PlayDocument> {
    const source = await this.findOne(teamId, playId);
    const playbookId = dto.playbookId ?? source.playbookId;
    if (dto.playbookId) {
      await this.playbooks.findOne(teamId, dto.playbookId);
    }

    return this.playModel.create({
      teamId,
      playbookId,
      name: dto.name ?? `${source.name} (copia)`.slice(0, NAME_MAX_LENGTH),
      formationId: source.formationId,
      tags: [...source.tags],
      conceptIds: [...source.conceptIds],
      diagram: cloneDiagramWithNewIds(migrateDiagram(source.diagram)),
      createdBy: userId,
      updatedBy: userId,
    });
  }

  /** Historial de la jugada, la versión más reciente primero. No incluye los diagrams. */
  async listVersions(teamId: string, playId: string): Promise<PlayVersionDocument[]> {
    await this.findOne(teamId, playId);
    return this.versionModel
      .find({ teamId, playId })
      .select({ diagram: 0 })
      .sort({ version: -1 })
      .exec();
  }

  async findVersion(teamId: string, playId: string, version: number): Promise<PlayVersionDocument> {
    await this.findOne(teamId, playId);
    const found = await this.versionModel.findOne({ teamId, playId, version }).exec();
    if (!found) {
      throw new NotFoundException('Esa versión no existe en el historial');
    }
    return found;
  }

  /** Guarda la foto y borra las que pasen de MAX_VERSIONS_PER_PLAY. */
  private async saveVersion(
    play: PlayDocument,
    userId: string,
    session: ClientSession,
  ): Promise<void> {
    await this.versionModel.create(
      [
        {
          playId: play._id,
          teamId: play.teamId,
          version: play.version,
          name: play.name,
          diagram: play.diagram,
          createdBy: userId,
        },
      ],
      { session },
    );

    const oldest = await this.versionModel
      .find({ teamId: play.teamId, playId: play._id })
      .select({ _id: 1 })
      .sort({ version: -1 })
      .skip(MAX_VERSIONS_PER_PLAY)
      .session(session)
      .exec();
    if (oldest.length > 0) {
      await this.versionModel
        .deleteMany({ _id: { $in: oldest.map((version) => version._id) } })
        .session(session)
        .exec();
    }
  }

  /** Si la jugada existe, el fallo es porque otro coach la guardó antes (409). */
  private async updateFailure(teamId: string, playId: string): Promise<Error> {
    const current = await this.playModel
      .findOne({ _id: playId, teamId, deletedAt: null })
      .select({ version: 1 })
      .exec();
    return current
      ? new ConflictException(
          `Otro coach guardó esta jugada mientras la editabas (versión actual: ${current.version}). Recárgala antes de guardar.`,
        )
      : new NotFoundException(PLAY_NOT_FOUND);
  }
}
