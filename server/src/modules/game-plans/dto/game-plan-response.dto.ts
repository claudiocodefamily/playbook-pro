import { ApiProperty } from '@nestjs/swagger';
import type { GamePlanDocument } from '../schemas/game-plan.schema.js';

/** Datos de un game plan sin las situaciones: para listados. */
export class GamePlanSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ example: 'Halcones' })
  opponent!: string;

  @ApiProperty({ type: String, nullable: true, example: '2026-11-07' })
  gameDate!: string | null;

  @ApiProperty({
    description: 'Jugadas en total, sumando todas las situaciones (solo las que puedes ver)',
  })
  playCount!: number;

  @ApiProperty({ description: 'Si los jugadores con cuenta pueden verlo' })
  visibleToPlayers!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  /** `known`: las jugadas que existen y que quien pregunta puede ver. */
  static from(plan: GamePlanDocument, known: ReadonlySet<string>): GamePlanSummaryResponseDto {
    const dto = new GamePlanSummaryResponseDto();
    GamePlanSummaryResponseDto.fill(dto, plan, known);
    return dto;
  }

  protected static fill(
    dto: GamePlanSummaryResponseDto,
    plan: GamePlanDocument,
    known: ReadonlySet<string>,
  ): void {
    dto.id = plan._id;
    dto.teamId = plan.teamId;
    dto.opponent = plan.opponent;
    dto.gameDate = plan.gameDate ?? null;
    dto.playCount = plan.situations.reduce(
      (sum, situation) => sum + situation.playIds.filter((playId) => known.has(playId)).length,
      0,
    );
    dto.visibleToPlayers = plan.visibleToPlayers;
    dto.createdAt = plan.createdAt;
    dto.updatedAt = plan.updatedAt;
  }
}

export class GamePlanSituationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Red zone' })
  name!: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  playIds!: string[];
}

/** Lo justo de cada jugada para la lista y el call sheet. */
export class GamePlanPlayDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Mesh Right' })
  name!: string;

  @ApiProperty({ format: 'uuid' })
  playbookId!: string;

  @ApiProperty({ example: 'Ofensiva 2026' })
  playbookName!: string;
}

export class GamePlanResponseDto extends GamePlanSummaryResponseDto {
  @ApiProperty({
    type: [GamePlanSituationResponseDto],
    description: 'Solo con las jugadas que existen y que quien pregunta puede ver',
  })
  situations!: GamePlanSituationResponseDto[];

  @ApiProperty({
    type: [GamePlanPlayDto],
    description: 'Las jugadas que aparecen en las situaciones',
  })
  plays!: GamePlanPlayDto[];

  static fromPlan(plan: GamePlanDocument, plays: GamePlanPlayDto[]): GamePlanResponseDto {
    const dto = new GamePlanResponseDto();
    const known = new Set(plays.map((play) => play.id));
    GamePlanSummaryResponseDto.fill(dto, plan, known);
    dto.situations = plan.situations.map((situation) => ({
      id: situation.id,
      name: situation.name,
      playIds: situation.playIds.filter((playId) => known.has(playId)),
    }));
    dto.plays = plays;
    return dto;
  }
}
