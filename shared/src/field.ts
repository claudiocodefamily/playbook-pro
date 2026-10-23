import type { Ruleset } from './enums.js';

/** Ancho del campo: 160 pies = 53⅓ yardas. */
export const FIELD_WIDTH_YARDS = 160 / 3;
export const FIELD_HALF_WIDTH_YARDS = FIELD_WIDTH_YARDS / 2;

/**
 * Distancia (en yardas) desde el centro del campo hasta cada hash mark.
 * - High school: hashes a 53'4" de cada banda (dividen el campo en tercios).
 * - College: hashes a 60' de cada banda (40' entre ellos).
 * - NFL: hashes a 70'9" de cada banda (18'6" entre ellos).
 */
export const HASH_OFFSET_YARDS: Readonly<Record<Ruleset, number>> = {
  high_school: 160 / 3 / 3 / 2, // 53'4" entre hashes = 17.78 yd
  college: 40 / 3 / 2, // 40' entre hashes = 13.33 yd
  nfl: 18.5 / 3 / 2, // 18'6" entre hashes = 6.17 yd
};

export const DEFAULT_RULESET: Ruleset = 'college';

/**
 * Mitad del ancho entre los postes de la portería: 18'6" en college y NFL, 23'4" en
 * high school.
 */
export const GOAL_POST_HALF_WIDTH_YARDS: Readonly<Record<Ruleset, number>> = {
  high_school: 23 / 3 / 2 + 4 / 36 / 2, // 23'4" = 7.78 yd
  college: 18.5 / 3 / 2, // 18'6" = 6.17 yd
  nfl: 18.5 / 3 / 2,
};

/**
 * Dónde están los postes respecto a la LOS (en y), con el balón en `yardLine`: en la
 * línea de fondo, 10 yardas detrás de la línea de gol rival.
 */
export function goalPostsY(yardLine: number): number {
  return 110 - yardLine;
}

/** Línea de gol rival respecto a la LOS. */
export function goalLineY(yardLine: number): number {
  return 100 - yardLine;
}
