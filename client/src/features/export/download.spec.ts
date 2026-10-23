import { describe, expect, it } from 'vitest';
import { safeFilename } from './download';

describe('safeFilename', () => {
  it('quita tildes, espacios y símbolos', () => {
    expect(safeFilename('Mesh Right / Pistola')).toBe('Mesh-Right-Pistola');
    expect(safeFilename('Ofensiva 2026: año ñ')).toBe('Ofensiva-2026-ano-n');
  });

  it('nunca devuelve un nombre vacío', () => {
    expect(safeFilename('¿?')).toBe('jugada');
  });
});
