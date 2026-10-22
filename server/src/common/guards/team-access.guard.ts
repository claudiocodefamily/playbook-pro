import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UuidSchema } from '@playbook/shared';
import { TeamsService } from '../../modules/teams/teams.service.js';
import type { RequestWithUser } from '../decorators/current-user.decorator.js';

/**
 * Aislamiento entre equipos: solo deja pasar a los coaches del equipo de la URL
 * (`/teams/:teamId/...`). Va siempre después de `JwtAuthGuard`.
 *
 * Responde 404, y no 403, para no revelar a un extraño que el equipo existe.
 */
@Injectable()
export class TeamAccessGuard implements CanActivate {
  constructor(private readonly teams: TeamsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    const teamId = UuidSchema.safeParse(request.params.teamId);
    if (!teamId.success) {
      throw new BadRequestException('El id del equipo no es un UUIDv7 válido');
    }

    if (!(await this.teams.isMember(teamId.data, request.user.id))) {
      throw new NotFoundException('Equipo no encontrado');
    }
    return true;
  }
}
