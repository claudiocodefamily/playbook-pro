import { ApiProperty } from '@nestjs/swagger';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import type { ConceptDocument } from '../schemas/concept.schema.js';

export class ConceptResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'null en los conceptos globales',
  })
  teamId!: string | null;

  @ApiProperty({ description: 'true = concepto global; no se puede editar ni borrar' })
  isGlobal!: boolean;

  @ApiProperty({ example: 'Mesh' })
  name!: string;

  @ApiProperty({ enum: PLAYBOOK_SIDES })
  side!: PlaybookSide;

  @ApiProperty()
  explanation!: string;

  @ApiProperty({ description: 'Jugadas del equipo que enseñan este concepto' })
  playCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(concept: ConceptDocument, playCount = 0): ConceptResponseDto {
    const dto = new ConceptResponseDto();
    dto.id = concept._id;
    dto.teamId = concept.teamId;
    dto.isGlobal = concept.teamId === null;
    dto.name = concept.name;
    dto.side = concept.side;
    dto.explanation = concept.explanation;
    dto.playCount = playCount;
    dto.createdAt = concept.createdAt;
    dto.updatedAt = concept.updatedAt;
    return dto;
  }
}
