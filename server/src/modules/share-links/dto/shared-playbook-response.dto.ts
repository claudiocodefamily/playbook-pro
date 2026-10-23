import { ApiProperty } from '@nestjs/swagger';
import {
  PLAYBOOK_SIDES,
  RULESETS,
  type PlayDiagram,
  type PlaybookSide,
  type Ruleset,
} from '@playbook/shared';

export class SharedConceptDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Mesh' })
  name!: string;

  @ApiProperty()
  explanation!: string;
}

export class SharedPlayDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Mesh Right' })
  name!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty({ type: [String], format: 'uuid' })
  conceptIds!: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  diagram!: PlayDiagram;
}

/** Lo que ve quien abre un link de solo lectura: sin ids de usuarios ni datos del equipo. */
export class SharedPlaybookResponseDto {
  @ApiProperty({ example: 'Lobos' })
  teamName!: string;

  @ApiProperty({ enum: RULESETS })
  ruleset!: Ruleset;

  @ApiProperty({ example: 'Ofensiva 2026' })
  name!: string;

  @ApiProperty({ enum: PLAYBOOK_SIDES })
  side!: PlaybookSide;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [SharedPlayDto] })
  plays!: SharedPlayDto[];

  @ApiProperty({ type: [SharedConceptDto], description: 'Los conceptos que enseñan sus jugadas' })
  concepts!: SharedConceptDto[];
}
