import type { FormationSlot, PlayDiagram, PlaybookSide, Ruleset } from '@playbook/shared';

// Respuestas de la API, tal como las documenta Swagger. Las fechas llegan como texto ISO.

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  ruleset: Ruleset;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Playbook {
  id: string;
  teamId: string;
  name: string;
  side: PlaybookSide;
  description: string;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Formation {
  id: string;
  teamId: string | null;
  isGlobal: boolean;
  name: string;
  side: PlaybookSide;
  players: FormationSlot[];
}

export interface PlaySummary {
  id: string;
  teamId: string;
  playbookId: string;
  name: string;
  formationId: string | null;
  tags: string[];
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Play extends PlaySummary {
  diagram: PlayDiagram;
}
