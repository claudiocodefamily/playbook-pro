import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { UuidSchema } from '@playbook/shared';

/** Valida que un parámetro de la URL (`:teamId`, `:playerId`...) sea un UUIDv7. */
@Injectable()
export class ParseUuidPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const result = UuidSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException('El id no es un UUIDv7 válido');
    }
    return result.data;
  }
}
