import { createHash } from 'node:crypto';

/**
 * Firma de una subida a Cloudinary: los parámetros ordenados por nombre como
 * `clave=valor` unidos con `&`, seguidos del API secret, en SHA-1 hexadecimal.
 * Así el navegador sube la foto directamente sin conocer el secreto.
 */
export function cloudinarySignature(
  params: Readonly<Record<string, string | number>>,
  apiSecret: string,
): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(payload + apiSecret)
    .digest('hex');
}
