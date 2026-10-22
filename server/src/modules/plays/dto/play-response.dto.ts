import { ApiProperty } from '@nestjs/swagger';
import { migrateDiagram, type PlayDiagram } from '@playbook/shared';
import type { PlayDocument } from '../schemas/play.schema.js';

/** Datos de una jugada sin el diagram: para listados. */
export class PlaySummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ format: 'uuid' })
  playbookId!: string;

  @ApiProperty({ example: 'Mesh Right' })
  name!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  formationId!: string | null;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({ description: 'Envíala en el PATCH para el bloqueo optimista' })
  version!: number;

  @ApiProperty({ format: 'uuid' })
  createdBy!: string;

  @ApiProperty({ format: 'uuid' })
  updatedBy!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(play: PlayDocument): PlaySummaryResponseDto {
    return Object.assign(new PlaySummaryResponseDto(), summaryFields(play));
  }
}

export class PlayResponseDto extends PlaySummaryResponseDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Siempre en la versión actual del esquema (se migra al leer)',
  })
  diagram!: PlayDiagram;

  static override from(play: PlayDocument): PlayResponseDto {
    return Object.assign(new PlayResponseDto(), summaryFields(play), {
      diagram: migrateDiagram(play.diagram),
    });
  }
}

function summaryFields(play: PlayDocument): PlaySummaryResponseDto {
  return {
    id: play._id,
    teamId: play.teamId,
    playbookId: play.playbookId,
    name: play.name,
    formationId: play.formationId,
    tags: [...play.tags],
    version: play.version,
    createdBy: play.createdBy,
    updatedBy: play.updatedBy,
    createdAt: play.createdAt,
    updatedAt: play.updatedAt,
  };
}
