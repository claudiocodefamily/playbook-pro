import type {
  FormationSlot,
  PlayDiagram,
  PlaybookSide,
  Position,
  Ruleset,
  TeamRole,
} from '@playbook/shared';

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

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}

export interface RosterPlayer {
  id: string;
  teamId: string;
  name: string;
  number: number;
  positions: Position[];
  photoUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Un término del glosario (Mesh, Cover 2...): del equipo o global. */
export interface Concept {
  id: string;
  teamId: string | null;
  isGlobal: boolean;
  name: string;
  side: PlaybookSide;
  explanation: string;
  /** Jugadas del equipo que lo enseñan. */
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Firma para subir una foto directamente a Cloudinary. */
export interface UploadSignature {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
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
  /** Conceptos del glosario que enseña la jugada. */
  conceptIds: string[];
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Play extends PlaySummary {
  diagram: PlayDiagram;
}

/** Una foto guardada con "Guardar versión". */
export interface PlayVersionSummary {
  id: string;
  playId: string;
  version: number;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface PlayVersion extends PlayVersionSummary {
  diagram: PlayDiagram;
}

/** Un link de solo lectura a un playbook. El token solo llega al crearlo. */
export interface ShareLink {
  id: string;
  playbookId: string;
  label: string;
  expiresAt: string | null;
  createdAt: string;
  token?: string;
}

/** Lo que ve quien abre un link compartido: el playbook con sus jugadas y conceptos. */
export interface SharedPlaybook {
  teamName: string;
  ruleset: Ruleset;
  name: string;
  side: PlaybookSide;
  description: string;
  plays: { id: string; name: string; tags: string[]; conceptIds: string[]; diagram: PlayDiagram }[];
  concepts: { id: string; name: string; explanation: string }[];
}
