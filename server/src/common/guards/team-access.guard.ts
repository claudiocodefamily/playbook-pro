import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UuidSchema } from '@playbook/shared';
import { TeamsService } from '../../modules/teams/teams.service.js';
import { ALLOW_PLAYERS_KEY } from '../decorators/allow-players.decorator.js';
import type { RequestWithMembership } from '../decorators/team-member.decorator.js';

/**
 * Aislamiento entre equipos: solo deja pasar a los miembros del equipo de la URL
 * (`/teams/:teamId/...`). Va siempre después de `JwtAuthGuard`.
 *
 * Responde 404, y no 403, para no revelar a un extraño que el equipo existe. Los jugadores
 * solo pasan por las rutas marcadas con `@AllowPlayers()`; en las demás reciben 403.
 */
@Injectable()
export class TeamAccessGuard implements CanActivate {
  constructor(
    private readonly teams: TeamsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMembership>();
    if (!request.user) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    const teamId = UuidSchema.safeParse(request.params.teamId);
    if (!teamId.success) {
      throw new BadRequestException('El id del equipo no es un UUIDv7 válido');
    }

    const member = await this.teams.membership(teamId.data, request.user.id);
    if (!member) {
      throw new NotFoundException('Equipo no encontrado');
    }
    if (member.role !== 'COACH') {
      const allowPlayers = this.reflector.getAllAndOverride<boolean | undefined>(
        ALLOW_PLAYERS_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowPlayers) {
        throw new ForbiddenException('Solo los coaches del equipo pueden hacer esto');
      }
    }
    request.membership = member;
    return true;
  }
}
