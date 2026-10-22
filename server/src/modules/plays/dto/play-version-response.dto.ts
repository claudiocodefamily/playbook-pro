import { ApiProperty } from '@nestjs/swagger';
import { migrateDiagram, type PlayDiagram } from '@playbook/shared';
import type { PlayVersionDocument } from '../schemas/play-version.schema.js';

/** Una entrada del historial, sin el diagram. */
export class PlayVersionSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  playId!: string;

  @ApiProperty({ example: 4 })
  version!: number;

  @ApiProperty({ description: 'Nombre de la jugada en ese momento' })
  name!: string;

  @ApiProperty({ format: 'uuid' })
  createdBy!: string;

  @ApiProperty()
  createdAt!: Date;

  static from(version: PlayVersionDocument): PlayVersionSummaryResponseDto {
    return Object.assign(new PlayVersionSummaryResponseDto(), summaryFields(version));
  }
}

export class PlayVersionResponseDto extends PlayVersionSummaryResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  diagram!: PlayDiagram;

  static override from(version: PlayVersionDocument): PlayVersionResponseDto {
    return Object.assign(new PlayVersionResponseDto(), summaryFields(version), {
      diagram: migrateDiagram(version.diagram),
    });
  }
}

function summaryFields(version: PlayVersionDocument): PlayVersionSummaryResponseDto {
  return {
    id: version._id,
    playId: version.playId,
    version: version.version,
    name: version.name,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
  };
}
