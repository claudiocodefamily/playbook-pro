import { ApiPropertyOptional } from '@nestjs/swagger';
import { UuidSchema } from '@playbook/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MatchesZod } from '../../../common/validators/matches-zod.validator.js';

export class DuplicatePlayDto {
  @ApiPropertyOptional({
    example: 'Mesh Left',
    maxLength: 120,
    description: 'Sin valor: "<nombre> (copia)"',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Sin valor: el mismo playbook' })
  @IsOptional()
  @MatchesZod(UuidSchema, { message: 'playbookId no es un UUIDv7 válido' })
  playbookId?: string;
}
