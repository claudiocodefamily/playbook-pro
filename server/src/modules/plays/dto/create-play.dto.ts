import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UuidSchema, type PlayDiagramInput } from '@playbook/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MatchesZod } from '../../../common/validators/matches-zod.validator.js';
import { PlayConceptIds, PlayDiagramField, PlayTags } from './play-fields.js';

export class CreatePlayDto {
  @ApiProperty({ example: 'Mesh Right', maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la jugada es obligatorio' })
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Formación de partida (del equipo o global). Si no envías diagram, los jugadores se colocan según ella.',
  })
  @IsOptional()
  @MatchesZod(UuidSchema, { message: 'formationId no es un UUIDv7 válido' })
  formationId?: string;

  @PlayTags()
  tags?: string[];

  @PlayConceptIds()
  conceptIds?: string[];

  @PlayDiagramField('Sin valor, se crea vacío o a partir de la formación.')
  diagram?: PlayDiagramInput;
}
