import { type PlaybookSide } from '@playbook/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type ConceptInput,
  conceptsApi,
  formationsApi,
  type GamePlanInput,
  gamePlansApi,
  playbooksApi,
  playerAccountsApi,
  type PlayFilters,
  playsApi,
  type QuizInput,
  quizzesApi,
  type RosterInput,
  rosterApi,
  shareLinksApi,
  teamsApi,
  type TextQuestionInput,
} from './endpoints';
import type { GamePlan, Quiz } from './types';

/**
 * Claves y consultas de TanStack Query. Guarda en caché lo que ya se cargó, así volver
 * atrás es instantáneo, y lo refresca en segundo plano.
 */
export const queries = {
  teams: () => queryOptions({ queryKey: ['teams'], queryFn: teamsApi.list }),
  team: (teamId: string) =>
    queryOptions({ queryKey: ['teams', teamId], queryFn: () => teamsApi.get(teamId) }),
  members: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'members'],
      queryFn: () => teamsApi.members(teamId),
    }),
  roster: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'roster'],
      queryFn: () => rosterApi.list(teamId),
    }),
  concepts: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'concepts'],
      queryFn: () => conceptsApi.list(teamId),
    }),
  me: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'me'],
      queryFn: () => playerAccountsApi.me(teamId),
    }),
  playerAccess: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'player-accounts'],
      queryFn: () => playerAccountsApi.list(teamId),
      // Cambia cuando el jugador acepta en su móvil: se vuelve a pedir al abrir la pantalla.
      staleTime: 0,
    }),
  quizzes: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'quizzes'],
      queryFn: () => quizzesApi.list(teamId),
    }),
  quiz: (teamId: string, quizId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'quizzes', quizId],
      queryFn: () => quizzesApi.get(teamId, quizId),
    }),
  quizResults: (teamId: string, quizId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'quizzes', quizId, 'results'],
      queryFn: () => quizzesApi.results(teamId, quizId),
      // Los jugadores responden desde su móvil: se vuelve a pedir al abrir la pantalla.
      staleTime: 0,
    }),
  gamePlans: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'game-plans'],
      queryFn: () => gamePlansApi.list(teamId),
    }),
  gamePlan: (teamId: string, planId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'game-plans', planId],
      queryFn: () => gamePlansApi.get(teamId, planId),
    }),
  invite: (token: string) =>
    queryOptions({
      queryKey: ['invites', token],
      queryFn: () => playerAccountsApi.preview(token),
    }),
  shareLinks: (teamId: string, playbookId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'playbooks', playbookId, 'share-links'],
      queryFn: () => shareLinksApi.list(teamId, playbookId),
    }),
  shared: (token: string) =>
    queryOptions({
      queryKey: ['shared', token],
      queryFn: () => shareLinksApi.open(token),
    }),
  conceptPlays: (teamId: string, conceptId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'concepts', conceptId, 'plays'],
      queryFn: () => conceptsApi.plays(teamId, conceptId),
    }),
  playbooks: (teamId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'playbooks'],
      queryFn: () => playbooksApi.list(teamId),
    }),
  playbook: (teamId: string, playbookId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'playbooks', playbookId],
      queryFn: () => playbooksApi.get(teamId, playbookId),
    }),
  formations: (teamId: string, side?: PlaybookSide) =>
    queryOptions({
      queryKey: ['teams', teamId, 'formations', side ?? 'all'],
      queryFn: () => formationsApi.list(teamId, side),
      // Las globales casi nunca cambian.
      staleTime: 5 * 60_000,
    }),
  plays: (teamId: string, playbookId: string, filters: PlayFilters = {}) =>
    queryOptions({
      queryKey: ['teams', teamId, 'playbooks', playbookId, 'plays', filters],
      queryFn: () => playsApi.list(teamId, playbookId, filters),
      placeholderData: (previous) => previous,
    }),
  play: (teamId: string, playId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'plays', playId],
      queryFn: () => playsApi.get(teamId, playId),
    }),
  playVersions: (teamId: string, playId: string) =>
    queryOptions({
      queryKey: ['teams', teamId, 'plays', playId, 'versions'],
      queryFn: () => playsApi.versions(teamId, playId),
    }),
  playVersion: (teamId: string, playId: string, version: number) =>
    queryOptions({
      queryKey: ['teams', teamId, 'plays', playId, 'versions', version],
      queryFn: () => playsApi.version(teamId, playId, version),
      // Una versión guardada nunca cambia.
      staleTime: Infinity,
    }),
};

export function useCreateTeam() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => client.invalidateQueries({ queryKey: ['teams'], exact: true }),
  });
}

export function useCreatePlaybook(teamId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof playbooksApi.create>[1]) =>
      playbooksApi.create(teamId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queries.playbooks(teamId).queryKey }),
  });
}

export function useDeletePlaybook(teamId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (playbookId: string) => playbooksApi.remove(teamId, playbookId),
    onSuccess: () => client.invalidateQueries({ queryKey: queries.playbooks(teamId).queryKey }),
  });
}

/** Cualquier cambio en las jugadas de un playbook cambia también su contador. */
function useInvalidatePlays(teamId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queries.playbooks(teamId).queryKey });
}

export function useCreatePlay(teamId: string, playbookId: string) {
  const invalidate = useInvalidatePlays(teamId);
  return useMutation({
    mutationFn: (input: Parameters<typeof playsApi.create>[2]) =>
      playsApi.create(teamId, playbookId, input),
    onSuccess: invalidate,
  });
}

export function useDuplicatePlay(teamId: string) {
  const invalidate = useInvalidatePlays(teamId);
  return useMutation({
    mutationFn: (playId: string) => playsApi.duplicate(teamId, playId),
    onSuccess: invalidate,
  });
}

export function useDeletePlay(teamId: string) {
  const invalidate = useInvalidatePlays(teamId);
  return useMutation({
    mutationFn: (playId: string) => playsApi.remove(teamId, playId),
    onSuccess: invalidate,
  });
}

export function useUpdateTeam(teamId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof teamsApi.update>[1]) => teamsApi.update(teamId, input),
    onSuccess: (team) => {
      client.setQueryData(queries.team(teamId).queryKey, team);
      return client.invalidateQueries({ queryKey: ['teams'], exact: true });
    },
  });
}

/** Añadir o quitar coaches cambia la lista y el contador del equipo. */
function useMembersChanged(teamId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queries.members(teamId).queryKey }),
      client.invalidateQueries({ queryKey: queries.team(teamId).queryKey, exact: true }),
    ]);
}

export function useAddMember(teamId: string) {
  const changed = useMembersChanged(teamId);
  return useMutation({
    mutationFn: (email: string) => teamsApi.addMember(teamId, email),
    onSuccess: changed,
  });
}

export function useRemoveMember(teamId: string) {
  const changed = useMembersChanged(teamId);
  return useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: changed,
  });
}

function useRosterChanged(teamId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queries.roster(teamId).queryKey });
}

export function useSaveRosterPlayer(teamId: string) {
  const changed = useRosterChanged(teamId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: RosterInput }) =>
      id ? rosterApi.update(teamId, id, input) : rosterApi.create(teamId, input),
    onSuccess: changed,
  });
}

export function useDeleteRosterPlayer(teamId: string) {
  const changed = useRosterChanged(teamId);
  return useMutation({
    mutationFn: (playerId: string) => rosterApi.remove(teamId, playerId),
    onSuccess: changed,
  });
}

function useConceptsChanged(teamId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queries.concepts(teamId).queryKey });
}

export function useSaveConcept(teamId: string) {
  const changed = useConceptsChanged(teamId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ConceptInput }) =>
      id ? conceptsApi.update(teamId, id, input) : conceptsApi.create(teamId, input),
    onSuccess: changed,
  });
}

export function useDeleteConcept(teamId: string) {
  const changed = useConceptsChanged(teamId);
  return useMutation({
    mutationFn: (conceptId: string) => conceptsApi.remove(teamId, conceptId),
    onSuccess: changed,
  });
}

function useShareLinksChanged(teamId: string, playbookId: string) {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({ queryKey: queries.shareLinks(teamId, playbookId).queryKey });
}

export function useCreateShareLink(teamId: string, playbookId: string) {
  const changed = useShareLinksChanged(teamId, playbookId);
  return useMutation({
    mutationFn: (input: { label?: string; expiresInDays: number | null }) =>
      shareLinksApi.create(teamId, playbookId, input),
    onSuccess: changed,
  });
}

export function useRevokeShareLink(teamId: string, playbookId: string) {
  const changed = useShareLinksChanged(teamId, playbookId);
  return useMutation({
    mutationFn: (linkId: string) => shareLinksApi.revoke(teamId, playbookId, linkId),
    onSuccess: changed,
  });
}

export function useUpdatePlaybook(teamId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      playbookId,
      input,
    }: {
      playbookId: string;
      input: Parameters<typeof playbooksApi.update>[2];
    }) => playbooksApi.update(teamId, playbookId, input),
    onSuccess: (playbook) => {
      client.setQueryData(queries.playbook(teamId, playbook.id).queryKey, playbook);
      void client.invalidateQueries({ queryKey: queries.playbooks(teamId).queryKey });
    },
  });
}

function usePlayerAccessChanged(teamId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queries.playerAccess(teamId).queryKey });
}

export function useInvitePlayer(teamId: string) {
  const changed = usePlayerAccessChanged(teamId);
  return useMutation({
    mutationFn: (rosterPlayerId: string) => playerAccountsApi.invite(teamId, rosterPlayerId),
    onSuccess: changed,
  });
}

export function useRemovePlayerAccess(teamId: string) {
  const changed = usePlayerAccessChanged(teamId);
  return useMutation({
    mutationFn: (rosterPlayerId: string) => playerAccountsApi.remove(teamId, rosterPlayerId),
    onSuccess: changed,
  });
}

export function useAcceptInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => playerAccountsApi.accept(token),
    onSuccess: () => client.invalidateQueries({ queryKey: queries.teams().queryKey }),
  });
}

/** Guarda el quiz que devuelve el servidor y refresca el listado. */
function useQuizSaved(teamId: string) {
  const client = useQueryClient();
  return (quiz: Quiz) => {
    client.setQueryData(queries.quiz(teamId, quiz.id).queryKey, quiz);
    void client.invalidateQueries({ queryKey: queries.quizzes(teamId).queryKey, exact: true });
  };
}

export function useCreateQuiz(teamId: string) {
  const saved = useQuizSaved(teamId);
  return useMutation({
    mutationFn: (input: QuizInput) => quizzesApi.create(teamId, input),
    onSuccess: saved,
  });
}

export function useUpdateQuiz(teamId: string, quizId: string) {
  const saved = useQuizSaved(teamId);
  return useMutation({
    mutationFn: (input: Parameters<typeof quizzesApi.update>[2]) =>
      quizzesApi.update(teamId, quizId, input),
    onSuccess: saved,
  });
}

export function useDeleteQuiz(teamId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => quizzesApi.remove(teamId, quizId),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queries.quizzes(teamId).queryKey, exact: true }),
  });
}

export function useAddQuizQuestion(teamId: string, quizId: string) {
  const saved = useQuizSaved(teamId);
  return useMutation({
    mutationFn: (input: TextQuestionInput) => quizzesApi.addQuestion(teamId, quizId, input),
    onSuccess: saved,
  });
}

export function useRemoveQuizQuestion(teamId: string, quizId: string) {
  const saved = useQuizSaved(teamId);
  return useMutation({
    mutationFn: (questionId: string) => quizzesApi.removeQuestion(teamId, quizId, questionId),
    onSuccess: saved,
  });
}

export function useSubmitQuiz(teamId: string, quizId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answers: { questionId: string; optionId: string }[]) =>
      quizzesApi.submit(teamId, quizId, answers),
    // Cambian mis intentos y mi mejor nota.
    onSuccess: () => client.invalidateQueries({ queryKey: queries.quizzes(teamId).queryKey }),
  });
}

/** Guarda el game plan que devuelve el servidor y refresca el listado. */
function useGamePlanSaved(teamId: string) {
  const client = useQueryClient();
  return (plan: GamePlan) => {
    client.setQueryData(queries.gamePlan(teamId, plan.id).queryKey, plan);
    void client.invalidateQueries({ queryKey: queries.gamePlans(teamId).queryKey, exact: true });
  };
}

export function useCreateGamePlan(teamId: string) {
  const saved = useGamePlanSaved(teamId);
  return useMutation({
    mutationFn: (input: Parameters<typeof gamePlansApi.create>[1]) =>
      gamePlansApi.create(teamId, input),
    onSuccess: saved,
  });
}

/**
 * Cambios del game plan. Se enseñan al momento (antes de que conteste el servidor) para
 * que ordenar jugadas sea ágil; si el servidor dice que no, se vuelve a lo guardado.
 */
export function useUpdateGamePlan(teamId: string, planId: string) {
  const client = useQueryClient();
  const saved = useGamePlanSaved(teamId);
  const key = queries.gamePlan(teamId, planId).queryKey;
  return useMutation({
    mutationFn: (input: Partial<GamePlanInput>) => gamePlansApi.update(teamId, planId, input),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData(key);
      if (previous) client.setQueryData(key, { ...previous, ...input });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSuccess: saved,
  });
}

export function useDeleteGamePlan(teamId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => gamePlansApi.remove(teamId, planId),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queries.gamePlans(teamId).queryKey, exact: true }),
  });
}
