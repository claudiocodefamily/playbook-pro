import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DIAGRAM_SCHEMA_VERSION, PlayDiagramSchema } from '@playbook/shared';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, Length } from 'class-validator';
import { MatchesZod } from '../../../common/validators/matches-zod.validator.js';

export const MAX_TAGS = 20;

/** Etiquetas de una jugada: sin espacios sobrantes, en minúsculas y sin repetir. */
export function PlayTags(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: [String],
      example: ['red zone', '3rd down'],
      maxItems: MAX_TAGS,
      description: 'Se guardan en minúsculas',
    }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      Array.isArray(value)
        ? value.map((tag: unknown) => (typeof tag === 'string' ? tag.trim().toLowerCase() : tag))
        : value,
    ),
    IsArray(),
    ArrayMaxSize(MAX_TAGS, { message: `Una jugada tiene como máximo ${MAX_TAGS} etiquetas` }),
    ArrayUnique({ message: 'Hay etiquetas repetidas' }),
    IsString({ each: true }),
    Length(1, 30, { each: true, message: 'Cada etiqueta debe tener de 1 a 30 caracteres' }),
  );
}

/** El diagram completo de la jugada, validado con el esquema Zod compartido con el editor. */
export function PlayDiagramField(description: string): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: 'object',
      additionalProperties: true,
      description: `${description} Esquema: PlayDiagramSchema (v${DIAGRAM_SCHEMA_VERSION}) de @playbook/shared.`,
    }),
    IsOptional(),
    MatchesZod(PlayDiagramSchema),
  );
}
