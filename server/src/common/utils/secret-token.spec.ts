import { hashSecretToken, isSecretTokenShape, newSecretToken } from './secret-token.js';

describe('secret-token', () => {
  it('genera tokens de 43 caracteres distintos cada vez', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newSecretToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(isSecretTokenShape(token)).toBe(true);
  });

  it('el hash es estable y no contiene el token', () => {
    const token = newSecretToken();
    expect(hashSecretToken(token)).toBe(hashSecretToken(token));
    expect(hashSecretToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecretToken(token)).not.toContain(token);
  });

  it('rechaza lo que no tiene forma de token', () => {
    expect(isSecretTokenShape('corto')).toBe(false);
    expect(isSecretTokenShape(`${'a'.repeat(42)}!`)).toBe(false);
  });
});
