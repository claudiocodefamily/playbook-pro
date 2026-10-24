import { GAME_PLAN_MAX_PLAYS_PER_SITUATION, newId } from '@playbook/shared';
import type { GamePlanSituation } from '../../lib/api/types';

type Situations = readonly GamePlanSituation[];

/** Mueve un elemento `delta` posiciones (−1 arriba, +1 abajo). Fuera de rango, no hace nada. */
export function move<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const result = [...items];
  const [item] = result.splice(index, 1);
  result.splice(target, 0, item as T);
  return result;
}

function change(
  situations: Situations,
  situationId: string,
  update: (situation: GamePlanSituation) => GamePlanSituation,
): GamePlanSituation[] {
  return situations.map((situation) =>
    situation.id === situationId ? update(situation) : situation,
  );
}

/** Añade la jugada al final de la situación, si no estaba ya y si cabe. */
export function addPlay(situations: Situations, situationId: string, playId: string) {
  return change(situations, situationId, (situation) =>
    situation.playIds.includes(playId) ||
    situation.playIds.length >= GAME_PLAN_MAX_PLAYS_PER_SITUATION
      ? situation
      : { ...situation, playIds: [...situation.playIds, playId] },
  );
}

export function removePlay(situations: Situations, situationId: string, playId: string) {
  return change(situations, situationId, (situation) => ({
    ...situation,
    playIds: situation.playIds.filter((id) => id !== playId),
  }));
}

export function movePlay(
  situations: Situations,
  situationId: string,
  index: number,
  delta: number,
) {
  return change(situations, situationId, (situation) => ({
    ...situation,
    playIds: move(situation.playIds, index, delta),
  }));
}

export function renameSituation(situations: Situations, situationId: string, name: string) {
  return change(situations, situationId, (situation) => ({ ...situation, name }));
}

export function addSituation(situations: Situations, name: string): GamePlanSituation[] {
  return [...situations, { id: newId(), name, playIds: [] }];
}

export function removeSituation(situations: Situations, situationId: string) {
  return situations.filter((situation) => situation.id !== situationId);
}

const dateFormat = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "sáb, 7 nov 2026". La fecha es solo el día, así que se lee en UTC para no correrla. */
export function formatGameDate(gameDate: string | null): string | null {
  return gameDate ? dateFormat.format(new Date(`${gameDate}T00:00:00Z`)) : null;
}
