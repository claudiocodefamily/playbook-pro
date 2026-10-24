/** Situaciones con las que nace un game plan. El coach puede renombrarlas, quitarlas o añadir. */
export const DEFAULT_GAME_PLAN_SITUATIONS = [
  '1st & 10',
  '3rd & corto (1-3)',
  '3rd & medio (4-6)',
  '3rd & largo (7+)',
  'Red zone',
  'Goal line',
  '2 minutos',
  'Backed up',
] as const;

export const GAME_PLAN_MAX_SITUATIONS = 16;
export const GAME_PLAN_SITUATION_NAME_MAX = 40;
/** Jugadas como máximo en una situación: más no caben en la columna del call sheet. */
export const GAME_PLAN_MAX_PLAYS_PER_SITUATION = 30;
export const GAME_PLAN_OPPONENT_MAX = 80;
