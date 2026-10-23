import type { PlayDiagram, PlaybookSide, Ruleset } from '@playbook/shared';
import { api } from './client';
import type {
  AuthResponse,
  Concept,
  Formation,
  Play,
  Playbook,
  PlaySummary,
  PlayVersion,
  PlayVersionSummary,
  RosterPlayer,
  Team,
  TeamMember,
  UploadSignature,
  User,
} from './types';

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
  update: (teamId: string, input: { name?: string; ruleset?: Ruleset }) =>
    api.request<Team>(`/teams/${teamId}`, { method: 'PATCH', ...json(input) }),
  members: (teamId: string) => api.request<TeamMember[]>(`/teams/${teamId}/members`),
  addMember: (teamId: string, email: string) =>
    api.request<TeamMember[]>(`/teams/${teamId}/members`, { method: 'POST', ...json({ email }) }),
  removeMember: (teamId: string, userId: string) =>
    api.request<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
};

export interface RosterInput {
  name: string;
  number: number;
  positions: RosterPlayer['positions'];
  photoUrl?: string | null;
  active?: boolean;
}

export interface ConceptInput {
  name: string;
  side: PlaybookSide;
  explanation: string;
}

export const conceptsApi = {
  list: (teamId: string) => api.request<Concept[]>(`/teams/${teamId}/concepts`),
  create: (teamId: string, input: ConceptInput) =>
    api.request<Concept>(`/teams/${teamId}/concepts`, { method: 'POST', ...json(input) }),
  update: (teamId: string, conceptId: string, input: Partial<ConceptInput>) =>
    api.request<Concept>(`/teams/${teamId}/concepts/${conceptId}`, {
      method: 'PATCH',
      ...json(input),
    }),
  remove: (teamId: string, conceptId: string) =>
    api.request<void>(`/teams/${teamId}/concepts/${conceptId}`, { method: 'DELETE' }),
  plays: (teamId: string, conceptId: string) =>
    api.request<PlaySummary[]>(`/teams/${teamId}/concepts/${conceptId}/plays`),
};

export const rosterApi = {
  list: (teamId: string) => api.request<RosterPlayer[]>(`/teams/${teamId}/roster`),
  create: (teamId: string, input: RosterInput) =>
    api.request<RosterPlayer>(`/teams/${teamId}/roster`, {
      method: 'POST',
      // Al crear, sin foto se omite el campo (null solo sirve para quitarla al editar).
      ...json({ ...input, photoUrl: input.photoUrl ?? undefined }),
    }),
  update: (teamId: string, playerId: string, input: Partial<RosterInput>) =>
    api.request<RosterPlayer>(`/teams/${teamId}/roster/${playerId}`, {
      method: 'PATCH',
      ...json(input),
    }),
  remove: (teamId: string, playerId: string) =>
    api.request<void>(`/teams/${teamId}/roster/${playerId}`, { method: 'DELETE' }),
};

export const uploadsApi = {
  rosterPhotoSignature: (teamId: string) =>
    api.request<UploadSignature>(`/teams/${teamId}/uploads/roster-photo`, { method: 'POST' }),
};

/**
 * Sube una imagen directamente a Cloudinary con la firma que da la API (la foto no pasa
 * por nuestro servidor) y devuelve su URL https.
 */
export async function uploadToCloudinary(
  file: File,
  signature: UploadSignature,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('folder', signature.folder);
  form.append('signature', signature.signature);
  const response = await fetchImpl(signature.uploadUrl, { method: 'POST', body: form });
  const data: unknown = await response.json().catch(() => null);
  const url =
    data && typeof data === 'object' && 'secure_url' in data ? data.secure_url : undefined;
  if (!response.ok || typeof url !== 'string') {
    throw new Error('No se pudo subir la foto. Prueba con otra imagen o pega su URL.');
  }
  return url;
}

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
      conceptIds?: string[];
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
  versions: (teamId: string, playId: string) =>
    api.request<PlayVersionSummary[]>(`/teams/${teamId}/plays/${playId}/versions`),
  version: (teamId: string, playId: string, version: number) =>
    api.request<PlayVersion>(`/teams/${teamId}/plays/${playId}/versions/${version}`),
};
