import type { PlayDiagram, PlaybookSide, Ruleset } from '@playbook/shared';
import { api } from './client';
import type { AuthResponse, Formation, Play, Playbook, PlaySummary, Team, User } from './types';

const json = (body: unknown) => ({ body });

export const authApi = {
  login: (email: string, password: string) =>
    api.request<AuthResponse>('/auth/login', {
      method: 'POST',
      ...json({ email, password }),
      retryOnUnauthorized: false,
    }),
  register: (name: string, email: string, password: string) =>
    api.request<AuthResponse>('/auth/register', {
      method: 'POST',
      ...json({ name, email, password }),
      retryOnUnauthorized: false,
    }),
  logout: () => api.request<void>('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
  me: () => api.request<User>('/auth/me'),
};

export const teamsApi = {
  list: () => api.request<Team[]>('/teams'),
  get: (teamId: string) => api.request<Team>(`/teams/${teamId}`),
  create: (input: { name: string; ruleset?: Ruleset }) =>
    api.request<Team>('/teams', { method: 'POST', ...json(input) }),
};

export const playbooksApi = {
  list: (teamId: string) => api.request<Playbook[]>(`/teams/${teamId}/playbooks`),
  get: (teamId: string, playbookId: string) =>
    api.request<Playbook>(`/teams/${teamId}/playbooks/${playbookId}`),
  create: (teamId: string, input: { name: string; side: PlaybookSide; description?: string }) =>
    api.request<Playbook>(`/teams/${teamId}/playbooks`, { method: 'POST', ...json(input) }),
  remove: (teamId: string, playbookId: string) =>
    api.request<void>(`/teams/${teamId}/playbooks/${playbookId}`, { method: 'DELETE' }),
};

export const formationsApi = {
  list: (teamId: string, side?: PlaybookSide) =>
    api.request<Formation[]>(`/teams/${teamId}/formations${side ? `?side=${side}` : ''}`),
};

export interface PlayFilters {
  q?: string;
  tag?: string;
}

export const playsApi = {
  list: (teamId: string, playbookId: string, filters: PlayFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.tag) params.set('tag', filters.tag);
    const query = params.size > 0 ? `?${params.toString()}` : '';
    return api.request<PlaySummary[]>(`/teams/${teamId}/playbooks/${playbookId}/plays${query}`);
  },
  get: (teamId: string, playId: string) => api.request<Play>(`/teams/${teamId}/plays/${playId}`),
  create: (
    teamId: string,
    playbookId: string,
    input: { name: string; formationId?: string; tags?: string[]; diagram?: PlayDiagram },
  ) =>
    api.request<Play>(`/teams/${teamId}/playbooks/${playbookId}/plays`, {
      method: 'POST',
      ...json(input),
    }),
  update: (
    teamId: string,
    playId: string,
    input: {
      version: number;
      name?: string;
      tags?: string[];
      diagram?: PlayDiagram;
      formationId?: string | null;
      saveVersion?: boolean;
    },
  ) => api.request<Play>(`/teams/${teamId}/plays/${playId}`, { method: 'PATCH', ...json(input) }),
  duplicate: (teamId: string, playId: string, input: { name?: string; playbookId?: string } = {}) =>
    api.request<Play>(`/teams/${teamId}/plays/${playId}/duplicate`, {
      method: 'POST',
      ...json(input),
    }),
  remove: (teamId: string, playId: string) =>
    api.request<void>(`/teams/${teamId}/plays/${playId}`, { method: 'DELETE' }),
};
