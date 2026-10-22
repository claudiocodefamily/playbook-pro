import { registerDecorator, type ValidationOptions } from 'class-validator';
import type { z } from 'zod';

const MAX_ISSUES_IN_MESSAGE = 5;

/** Resume los errores de Zod en una línea: "players.0.x: Too big; ...". */
export function formatZodIssues(error: z.ZodError): string {
  const issues = error.issues.slice(0, MAX_ISSUES_IN_MESSAGE).map((issue) => {
    const path = issue.path.map(String).join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  const more = error.issues.length - issues.length;
  return more > 0 ? `${issues.join('; ')} (y ${more} más)` : issues.join('; ');
}

/**
 * Valida una propiedad de un DTO con un esquema Zod de `@playbook/shared`. Así el diagram
 * y los ids se validan con la misma regla en la API y en el editor, sin duplicarla.
 */
export function MatchesZod(schema: z.ZodType, options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'matchesZod',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate: (value: unknown) => schema.safeParse(value).success,
        defaultMessage: (args) => {
          const result = schema.safeParse(args?.value);
          const detail = result.success ? '' : formatZodIssues(result.error);
          return `${args?.property ?? 'valor'} no es válido: ${detail}`;
        },
      },
    });
  };
}
