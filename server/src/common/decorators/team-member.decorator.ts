import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TeamRole } from '@playbook/shared';
import type { RequestWithUser } from './current-user.decorator.js';

/** Quién es el usuario dentro del equipo de la URL. Lo deja `TeamAccessGuard`. */
export interface TeamMembership {
  role: TeamRole;
  /** Ficha del roster de un jugador con cuenta. */
  rosterPlayerId: string | null;
}

export type RequestWithMembership = RequestWithUser & { membership?: TeamMembership };

/** Inyecta el rol del usuario en el equipo: `@Membership() membership: TeamMembership`. */
export const Membership = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const { membership } = context.switchToHttp().getRequest<RequestWithMembership>();
  if (!membership) {
    throw new Error('@Membership se usó en una ruta sin TeamAccessGuard');
  }
  return membership;
});

/** true si la petición es de un jugador: solo ve lo que el coach hizo visible. */
export const isPlayer = (membership: TeamMembership): boolean => membership.role === 'PLAYER';
