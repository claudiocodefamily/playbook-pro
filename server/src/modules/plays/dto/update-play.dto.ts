import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UuidSchema, type PlayDiagramInput } from '@playbook/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MatchesZod } from '../../../common/validators/matches-zod.validator.js';
import { PlayDiagramField, PlayTags } from './play-fields.js';

export class UpdatePlayDto {
  @ApiProperty({
    example: 3,
    description:
      'La version que tenías al abrir la jugada. Si otro coach la guardó después, responde 409 y no se pisa su trabajo.',
  })
  @IsInt({ message: 'version debe ser un número entero' })
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 'Mesh Right', maxLength: 120 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la jugada no puede quedar vacío' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Mueve la jugada a otro playbook del equipo',
  })
  @IsOptional()
  @MatchesZod(UuidSchema, { message: 'playbookId no es un UUIDv7 válido' })
  playbookId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Envía null para desvincularla de la formación',
  })
  @ValidateIf((_dto, value) => value !== undefined && value !== null)
  @MatchesZod(UuidSchema, { message: 'formationId no es un UUIDv7 válido' })
  formationId?: string | null;

  @PlayTags()
  tags?: string[];

  @PlayDiagramField('Reemplaza el diagram completo.')
  diagram?: PlayDiagramInput;

  @ApiPropertyOptional({
    default: false,
    description: 'true = "Guardar versión": además guarda una foto en el historial',
  })
  @IsOptional()
  @IsBoolean()
  saveVersion?: boolean;
}
