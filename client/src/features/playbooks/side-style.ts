import type { PlaybookSide } from '@playbook/shared';

/** Color de cada unidad, para reconocer de un vistazo un playbook ofensivo o defensivo. */
export const SIDE_STYLE: Readonly<Record<PlaybookSide, string>> = {
  offense: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  defense: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
  special: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
};
