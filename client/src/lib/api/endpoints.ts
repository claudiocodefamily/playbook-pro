import type { PlayDiagram, PlaybookSide, Position, Ruleset } from '@playbook/shared';
import { api } from './client';
import type {
  AttemptResult,
  AuthResponse,
  InvitePreview,
  PlayerAccess,
  PlayerInvite,
  Concept,
  Formation,
  GamePlan,
  GamePlanSituation,
  GamePlanSummary,
  Play,
  Playbook,
  PlaySummary,
  PlayVersion,
  PlayVersionSummary,
  Quiz,
  QuizCoverage,
  QuizResults,
  QuizSummary,
  RosterPlayer,
  SharedPlaybook,
  ShareLink,
  Team,
  TeamMe,
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
  update: (
    teamId: string,
    playbookId: string,
    input: Partial<{ name: string; description: string; visibleToPlayers: boolean }>,
  ) =>
    api.request<Playbook>(`/teams/${teamId}/playbooks/${playbookId}`, {
      method: 'PATCH',
      ...json(input),
    }),
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

export const shareLinksApi = {
  list: (teamId: string, playbookId: string) =>
    api.request<ShareLink[]>(`/teams/${teamId}/playbooks/${playbookId}/share-links`),
  create: (
    teamId: string,
    playbookId: string,
    input: { label?: string; expiresInDays: number | null },
  ) =>
    api.request<ShareLink>(`/teams/${teamId}/playbooks/${playbookId}/share-links`, {
      method: 'POST',
      ...json(input),
    }),
  revoke: (teamId: string, playbookId: string, linkId: string) =>
    api.request<void>(`/teams/${teamId}/playbooks/${playbookId}/share-links/${linkId}`, {
      method: 'DELETE',
    }),
  /** Público: no necesita sesión. */
  open: (token: string) =>
    api.request<SharedPlaybook>(`/shared/${encodeURIComponent(token)}`, {
      retryOnUnauthorized: false,
    }),
};

export const playerAccountsApi = {
  me: (teamId: string) => api.request<TeamMe>(`/teams/${teamId}/me`),
  list: (teamId: string) => api.request<PlayerAccess[]>(`/teams/${teamId}/player-accounts`),
  invite: (teamId: string, rosterPlayerId: string) =>
    api.request<PlayerInvite>(`/teams/${teamId}/roster/${rosterPlayerId}/invite`, {
      method: 'POST',
    }),
  remove: (teamId: string, rosterPlayerId: string) =>
    api.request<void>(`/teams/${teamId}/player-accounts/${rosterPlayerId}`, { method: 'DELETE' }),
  /** Público: no necesita sesión. */
  preview: (token: string) =>
    api.request<InvitePreview>(`/invites/${encodeURIComponent(token)}`, {
      retryOnUnauthorized: false,
    }),
  accept: (token: string) =>
    api.request<{ teamId: string }>(`/invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    }),
};

export interface QuizInput {
  title: string;
  playbookId: string;
  positions: Position[];
  playIds?: string[];
}

export interface TextQuestionInput {
  prompt: string;
  options: string[];
  /** Posición de la respuesta correcta en `options`. */
  correctIndex: number;
}

export const quizzesApi = {
  list: (teamId: string) => api.request<QuizSummary[]>(`/teams/${teamId}/quizzes`),
  get: (teamId: string, quizId: string) => api.request<Quiz>(`/teams/${teamId}/quizzes/${quizId}`),
  create: (teamId: string, input: QuizInput) =>
    api.request<Quiz>(`/teams/${teamId}/quizzes`, { method: 'POST', ...json(input) }),
  update: (
    teamId: string,
    quizId: string,
    input: Partial<{ title: string; visibleToPlayers: boolean }>,
  ) => api.request<Quiz>(`/teams/${teamId}/quizzes/${quizId}`, { method: 'PATCH', ...json(input) }),
  remove: (teamId: string, quizId: string) =>
    api.request<void>(`/teams/${teamId}/quizzes/${quizId}`, { method: 'DELETE' }),
  addQuestion: (teamId: string, quizId: string, input: TextQuestionInput) =>
    api.request<Quiz>(`/teams/${teamId}/quizzes/${quizId}/questions`, {
      method: 'POST',
      ...json(input),
    }),
  removeQuestion: (teamId: string, quizId: string, questionId: string) =>
    api.request<Quiz>(`/teams/${teamId}/quizzes/${quizId}/questions/${questionId}`, {
      method: 'DELETE',
    }),
  coverage: (teamId: string, playbookId: string) =>
    api.request<QuizCoverage>(
      `/teams/${teamId}/quizzes/coverage?${new URLSearchParams({ playbookId })}`,
    ),
  results: (teamId: string, quizId: string) =>
    api.request<QuizResults>(`/teams/${teamId}/quizzes/${quizId}/results`),
  submit: (teamId: string, quizId: string, answers: { questionId: string; optionId: string }[]) =>
    api.request<AttemptResult>(`/teams/${teamId}/quizzes/${quizId}/attempts`, {
      method: 'POST',
      ...json({ answers }),
    }),
};

export interface GamePlanInput {
  opponent: string;
  gameDate: string | null;
  visibleToPlayers: boolean;
  situations: GamePlanSituation[];
}

export const gamePlansApi = {
  list: (teamId: string) => api.request<GamePlanSummary[]>(`/teams/${teamId}/game-plans`),
  get: (teamId: string, planId: string) =>
    api.request<GamePlan>(`/teams/${teamId}/game-plans/${planId}`),
  create: (teamId: string, input: { opponent: string; gameDate?: string | null }) =>
    api.request<GamePlan>(`/teams/${teamId}/game-plans`, { method: 'POST', ...json(input) }),
  update: (teamId: string, planId: string, input: Partial<GamePlanInput>) =>
    api.request<GamePlan>(`/teams/${teamId}/game-plans/${planId}`, {
      method: 'PATCH',
      ...json(input),
    }),
  remove: (teamId: string, planId: string) =>
    api.request<void>(`/teams/${teamId}/game-plans/${planId}`, { method: 'DELETE' }),
};
