import type { FormationSlot, PlaybookSide, Position } from '@playbook/shared';

export interface GlobalFormationSeed {
  name: string;
  side: PlaybookSide;
  players: FormationSlot[];
}

/** Atajo para escribir un hueco: el label coincide con el slotId. */
function slot(label: string, position: Position, x: number, y: number): FormationSlot {
  return { slotId: label, position, label, x, y };
}

// Línea ofensiva pegada a la LOS (y = -1), con el center sobre el balón.
const OFFENSIVE_LINE = [
  slot('LT', 'OL', -4, -1),
  slot('LG', 'OL', -2, -1),
  slot('C', 'OL', 0, -1),
  slot('RG', 'OL', 2, -1),
  slot('RT', 'OL', 4, -1),
];

// Front de 4 (dos defensive ends y dos tackles) a una yarda de la LOS.
const FOUR_MAN_FRONT = [
  slot('LE', 'DL', -5, 1),
  slot('T', 'DL', -1.5, 1),
  slot('N', 'DL', 1.5, 1),
  slot('RE', 'DL', 5, 1),
];

const CORNERS = [slot('LC', 'CB', -19, 7), slot('RC', 'CB', 17, 7)];
const SAFETIES = [slot('FS', 'S', -6, 13), slot('SS', 'S', 6, 12)];

/**
 * Formaciones globales (`teamId: null`) que ven todos los equipos.
 * Las ofensivas cumplen la regla de 7 jugadores en la LOS (y = -1).
 */
export const GLOBAL_FORMATIONS: readonly GlobalFormationSeed[] = [
  {
    name: 'Shotgun',
    side: 'offense',
    players: [
      ...OFFENSIVE_LINE,
      slot('Y', 'TE', 6, -1),
      slot('X', 'WR', -20, -1),
      slot('H', 'WR', -12, -2),
      slot('Z', 'WR', 18, -2),
      slot('QB', 'QB', 0, -5),
      slot('RB', 'RB', 2, -5),
    ],
  },
  {
    name: 'Pistol',
    side: 'offense',
    players: [
      ...OFFENSIVE_LINE,
      slot('Y', 'TE', 6, -1),
      slot('X', 'WR', -20, -1),
      slot('H', 'WR', -12, -2),
      slot('Z', 'WR', 18, -2),
      slot('QB', 'QB', 0, -4),
      slot('RB', 'RB', 0, -7),
    ],
  },
  {
    name: 'I-Form',
    side: 'offense',
    players: [
      ...OFFENSIVE_LINE,
      slot('Y', 'TE', 6, -1),
      slot('X', 'WR', -20, -1),
      slot('Z', 'WR', 18, -2),
      slot('QB', 'QB', 0, -2),
      slot('FB', 'RB', 0, -5),
      slot('RB', 'RB', 0, -7),
    ],
  },
  {
    name: 'Singleback',
    side: 'offense',
    players: [
      ...OFFENSIVE_LINE,
      slot('Y', 'TE', 6, -1),
      slot('X', 'WR', -20, -1),
      slot('H', 'TE', -6, -2),
      slot('Z', 'WR', 18, -2),
      slot('QB', 'QB', 0, -2),
      slot('RB', 'RB', 0, -6),
    ],
  },
  {
    name: 'Empty',
    side: 'offense',
    players: [
      ...OFFENSIVE_LINE,
      slot('X', 'WR', -20, -1),
      slot('Z', 'WR', 20, -1),
      slot('H', 'WR', -13, -2),
      slot('F', 'RB', -7, -2),
      slot('Y', 'TE', 12, -2),
      slot('QB', 'QB', 0, -5),
    ],
  },
  {
    name: '4-3',
    side: 'defense',
    players: [
      ...FOUR_MAN_FRONT,
      slot('Sam', 'LB', 5, 5),
      slot('Mike', 'LB', 0, 5),
      slot('Will', 'LB', -5, 5),
      ...CORNERS,
      ...SAFETIES,
    ],
  },
  {
    name: '3-4',
    side: 'defense',
    players: [
      slot('LE', 'DL', -4, 1),
      slot('N', 'DL', 0, 1),
      slot('RE', 'DL', 4, 1),
      slot('Jack', 'LB', -7, 2),
      slot('Will', 'LB', -2, 5),
      slot('Mike', 'LB', 2, 5),
      slot('Sam', 'LB', 7, 2),
      ...CORNERS,
      ...SAFETIES,
    ],
  },
  {
    name: 'Nickel',
    side: 'defense',
    players: [
      ...FOUR_MAN_FRONT,
      slot('Will', 'LB', -2, 5),
      slot('Mike', 'LB', 2, 5),
      slot('NB', 'CB', -11, 5),
      ...CORNERS,
      ...SAFETIES,
    ],
  },
  {
    name: 'Dime',
    side: 'defense',
    players: [
      ...FOUR_MAN_FRONT,
      slot('Mike', 'LB', 0, 6),
      slot('NB', 'CB', -11, 5),
      slot('DB', 'CB', 11, 5),
      ...CORNERS,
      ...SAFETIES,
    ],
  },
  {
    name: 'Punt',
    side: 'special',
    players: [
      slot('LT', 'OL', -4, -1),
      slot('LG', 'OL', -2, -1),
      slot('LS', 'OL', 0, -1),
      slot('RG', 'OL', 2, -1),
      slot('RT', 'OL', 4, -1),
      slot('G1', 'WR', -22, -1),
      slot('G2', 'WR', 22, -1),
      slot('W1', 'TE', -5, -2),
      slot('W2', 'TE', 5, -2),
      slot('PP', 'RB', 0, -6),
      slot('P', 'P', 0, -14),
    ],
  },
  {
    name: 'Kickoff',
    side: 'special',
    players: [
      slot('L5', 'CB', -22.5, -1),
      slot('L4', 'S', -18, -1),
      slot('L3', 'LB', -13.5, -1),
      slot('L2', 'LB', -9, -1),
      slot('L1', 'DL', -4.5, -1),
      slot('K', 'K', 0, -6),
      slot('R1', 'DL', 4.5, -1),
      slot('R2', 'LB', 9, -1),
      slot('R3', 'LB', 13.5, -1),
      slot('R4', 'S', 18, -1),
      slot('R5', 'CB', 22.5, -1),
    ],
  },
];
