import type { PlaybookSide } from '@playbook/shared';

/** Color de cada unidad, para reconocer de un vistazo un playbook ofensivo o defensivo. */
export const SIDE_STYLE: Readonly<Record<PlaybookSide, string>> = {
  offense: 'bg-sky-100 text-sky-800',
  defense: 'bg-rose-100 text-rose-800',
  special: 'bg-amber-100 text-amber-800',
};
