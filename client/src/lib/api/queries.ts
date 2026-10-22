import { type PlaybookSide } from '@playbook/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { formationsApi, playbooksApi, type PlayFilters, playsApi, teamsApi } from './endpoints';

/**
 * Claves y consultas de TanStack Query. Guarda en caché lo que ya se cargó, así volver
 * atrás es instantáneo, y lo refresca en segundo plano.
 */
export const queries = {
  teams: () => queryOptions({ queryKey: ['teams'], queryFn: teamsApi.list }),
  team: (teamId: string) =>
    queryOptions({ queryKey: ['teams', teamId], queryFn: () => teamsApi.get(teamId) }),
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
