import type { PlaybookSide, Ruleset } from '@playbook/shared';

export const SIDE_LABELS: Readonly<Record<PlaybookSide, string>> = {
  offense: 'Ofensiva',
  defense: 'Defensiva',
  special: 'Special teams',
};

export const RULESET_LABELS: Readonly<Record<Ruleset, string>> = {
  high_school: 'High school',
  college: 'College',
  nfl: 'NFL',
};
