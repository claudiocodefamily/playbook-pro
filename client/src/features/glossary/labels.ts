import type { PlaybookSide } from '@playbook/shared';

/** Unidad de un concepto, como se dice en el vestuario. */
export const CONCEPT_SIDE_LABELS: Readonly<Record<PlaybookSide, string>> = {
  offense: 'Ataque',
  defense: 'Defensa',
  special: 'Special teams',
};

/** Normaliza para buscar sin importar tildes ni mayúsculas: "Rápido" = "rapido". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
