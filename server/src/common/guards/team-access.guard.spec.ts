import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { newId } from '@playbook/shared';
import type { TeamMembership } from '../decorators/team-member.decorator.js';
import type { TeamsService } from '../../modules/teams/teams.service.js';
import { TeamAccessGuard } from './team-access.guard.js';

interface FakeRequest {
  user?: { id: string };
  params: Record<string, string>;
  membership?: TeamMembership;
}

function contextFor(request: FakeRequest) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('TeamAccessGuard', () => {
  const userId = newId();
  const teamId = newId();
  const membership = vi.fn<TeamsService['membership']>();
  const reflector = new Reflector();
  const allowPlayers = vi.spyOn(reflector, 'getAllAndOverride');
  const guard = new TeamAccessGuard({ membership } as unknown as TeamsService, reflector);

  beforeEach(() => {
    membership.mockReset();
    allowPlayers.mockReset();
  });

  it('deja pasar a un coach del equipo y deja su rol en la petición', async () => {
    membership.mockResolvedValue({ role: 'COACH', rosterPlayerId: null });
    const request: FakeRequest = { user: { id: userId }, params: { teamId } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(membership).toHaveBeenCalledWith(teamId, userId);
    expect(request.membership).toEqual({ role: 'COACH', rosterPlayerId: null });
  });

  it('a un jugador solo lo deja pasar en las rutas abiertas a jugadores', async () => {
    const rosterPlayerId = newId();
    membership.mockResolvedValue({ role: 'PLAYER', rosterPlayerId });
    const request: FakeRequest = { user: { id: userId }, params: { teamId } };

    allowPlayers.mockReturnValue(undefined);
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);

    allowPlayers.mockReturnValue(true);
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.membership).toEqual({ role: 'PLAYER', rosterPlayerId });
  });

  it('responde 404 a quien no es del equipo', async () => {
    membership.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextFor({ user: { id: userId }, params: { teamId } })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza un teamId que no es UUIDv7 sin consultar la base de datos', async () => {
    await expect(
      guard.canActivate(contextFor({ user: { id: userId }, params: { teamId: 'mi-equipo' } })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(membership).not.toHaveBeenCalled();
  });

  it('exige que haya un usuario autenticado', async () => {
    await expect(guard.canActivate(contextFor({ params: { teamId } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
