import { createEmptyDiagram, newId, PlayDiagramSchema, UuidSchema } from '@playbook/shared';
import { plainToInstance } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { MatchesZod } from './matches-zod.validator.js';

class ExampleDto {
  @MatchesZod(UuidSchema, { message: 'id no es un UUIDv7' })
  id!: string;

  @IsOptional()
  @MatchesZod(PlayDiagramSchema)
  diagram?: unknown;
}

async function errorsFor(input: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(ExampleDto, input));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('MatchesZod', () => {
  it('acepta valores que cumplen el esquema', async () => {
    expect(await errorsFor({ id: newId(), diagram: createEmptyDiagram() })).toEqual([]);
  });

  it('usa el mensaje propio cuando se indica', async () => {
    expect(await errorsFor({ id: 'abc' })).toEqual(['id no es un UUIDv7']);
  });

  it('explica dónde falla el diagram', async () => {
    const diagram = { ...createEmptyDiagram(), field: { yardLine: 120, hash: 'middle' } };
    const [message] = await errorsFor({ id: newId(), diagram });
    expect(message).toMatch(/^diagram no es válido: field\.yardLine: /);
  });
});
