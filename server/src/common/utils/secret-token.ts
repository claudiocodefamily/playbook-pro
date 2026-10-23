import { createHash, randomBytes } from 'node:crypto';

/** Forma de un token de `newSecretToken`: 32 bytes en base64url, siempre 43 caracteres. */
const SECRET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Token secreto para links (compartir, invitar). Sale de `crypto.randomBytes`, nunca de un
 * UUID, y en la base de datos solo se guarda su hash (`hashSecretToken`).
 */
export function newSecretToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 en hexadecimal. Basta sin sal: el token ya tiene 256 bits al azar. */
export function hashSecretToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Descarta sin ir a la base de datos lo que no puede ser un token. */
export function isSecretTokenShape(token: string): boolean {
  return SECRET_TOKEN_PATTERN.test(token);
}
