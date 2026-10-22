import { BadRequestException } from '@nestjs/common';
import { newId } from '@playbook/shared';
import { ParseUuidPipe } from './parse-uuid.pipe.js';

describe('ParseUuidPipe', () => {
  const pipe = new ParseUuidPipe();

  it('deja pasar un UUIDv7', () => {
    const id = newId();

    expect(pipe.transform(id)).toBe(id);
  });

  it('rechaza un ObjectId de Mongo, un UUIDv4 y texto libre', () => {
    expect(() => pipe.transform('507f1f77bcf86cd799439011')).toThrow(BadRequestException);
    expect(() => pipe.transform('3b241101-e2bb-4255-8caf-4136c566a962')).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform('mi-equipo')).toThrow(BadRequestException);
  });
});
