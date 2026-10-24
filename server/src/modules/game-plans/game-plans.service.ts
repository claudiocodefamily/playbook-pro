import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DEFAULT_GAME_PLAN_SITUATIONS, newId } from '@playbook/shared';
import type { Model } from 'mongoose';
import { toMongoUpdate } from '../../common/utils/mongo-update.js';
import { PlaybooksService, type Visibility } from '../playbooks/playbooks.service.js';
import { Play } from '../plays/schemas/play.schema.js';
import type { CreateGamePlanDto } from './dto/create-game-plan.dto.js';
import type { GamePlanPlayDto } from './dto/game-plan-response.dto.js';
import type { UpdateGamePlanDto } from './dto/update-game-plan.dto.js';
import { GamePlan, type GamePlanDocument } from './schemas/game-plan.schema.js';

const GAME_PLAN_NOT_FOUND = 'Game plan no encontrado';

const visibilityFilter = ({ playersOnly = false }: Visibility) =>
  playersOnly ? { visibleToPlayers: true } : {};

/** Todos los métodos filtran por `teamId`. */
@Injectable()
export class GamePlansService {
  constructor(
    @InjectModel(GamePlan.name) private readonly planModel: Model<GamePlan>,
    @InjectModel(Play.name) private readonly playModel: Model<Play>,
    private readonly playbooks: PlaybooksService,
  ) {}

  /** Nace con las situaciones típicas, vacías, y oculto a los jugadores. */
  create(teamId: string, userId: string, dto: CreateGamePlanDto): Promise<GamePlanDocument> {
    return this.planModel.create({
      teamId,
      opponent: dto.opponent,
      gameDate: dto.gameDate ?? null,
      situations: DEFAULT_GAME_PLAN_SITUATIONS.map((name) => ({ id: newId(), name, playIds: [] })),
      createdBy: userId,
    });
  }

  /** Los partidos más recientes primero; los que no tienen fecha, al final. */
  async findAll(teamId: string, visibility: Visibility = {}): Promise<GamePlanDocument[]> {
    const plans = await this.planModel
      .find({ teamId, ...visibilityFilter(visibility) })
      .sort({ gameDate: -1, createdAt: -1 })
      .exec();
    return [
      ...plans.filter((plan) => plan.gameDate !== null),
      ...plans.filter((plan) => plan.gameDate === null),
    ];
  }

  async findOne(
    teamId: string,
    planId: string,
    visibility: Visibility = {},
  ): Promise<GamePlanDocument> {
    const plan = await this.planModel
      .findOne({ _id: planId, teamId, ...visibilityFilter(visibility) })
      .exec();
    if (!plan) throw new NotFoundException(GAME_PLAN_NOT_FOUND);
    return plan;
  }

  async update(teamId: string, planId: string, dto: UpdateGamePlanDto): Promise<GamePlanDocument> {
    if (dto.situations) {
      const playIds = [...new Set(dto.situations.flatMap((situation) => situation.playIds))];
      const found = await this.playModel
        .countDocuments({ teamId, _id: { $in: playIds }, deletedAt: null })
        .exec();
      if (found !== playIds.length) {
        throw new BadRequestException('Alguna jugada no existe o no es de este equipo');
      }
    }
    const plan = await this.planModel
      .findOneAndUpdate({ _id: planId, teamId }, toMongoUpdate(dto), {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
    if (!plan) throw new NotFoundException(GAME_PLAN_NOT_FOUND);
    return plan;
  }

  async remove(teamId: string, planId: string): Promise<void> {
    const result = await this.planModel.deleteOne({ _id: planId, teamId }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(GAME_PLAN_NOT_FOUND);
  }

  /**
   * Las jugadas de estos game plans que siguen existiendo, con su playbook. Un jugador
   * solo recibe las de playbooks visibles para jugadores.
   */
  async plays(
    teamId: string,
    plans: readonly GamePlanDocument[],
    visibility: Visibility = {},
  ): Promise<GamePlanPlayDto[]> {
    const ids = [...new Set(plans.flatMap((plan) => plan.situations.flatMap((s) => s.playIds)))];
    if (ids.length === 0) return [];
    const [plays, playbooks] = await Promise.all([
      this.playModel
        .find({ teamId, _id: { $in: ids }, deletedAt: null })
        .select({ name: 1, playbookId: 1 })
        .exec(),
      this.playbooks.findAll(teamId, undefined, visibility),
    ]);
    const playbookNames = new Map(playbooks.map((playbook) => [playbook._id, playbook.name]));
    return plays.flatMap((play) => {
      const playbookName = playbookNames.get(play.playbookId);
      return playbookName === undefined
        ? []
        : [{ id: play._id, name: play.name, playbookId: play.playbookId, playbookName }];
    });
  }
}
