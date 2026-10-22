import {
  BadRequestException,
  type ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { newId } from '@playbook/shared';
import type { TeamsService } from '../../modules/teams/teams.service.js';
import { TeamAccessGuard } from './team-access.guard.js';

function contextFor(request: { user?: { id: string }; params: Record<string, string> }) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('TeamAccessGuard', () => {
  const userId = newId();
  const teamId = newId();
  const isMember = vi.fn<TeamsService['isMember']>();
  const guard = new TeamAccessGuard({ isMember } as unknown as TeamsService);

  beforeEach(() => {
    isMember.mockReset();
  });

  it('deja pasar a un coach del equipo', async () => {
    isMember.mockResolvedValue(true);

    await expect(
      guard.canActivate(contextFor({ user: { id: userId }, params: { teamId } })),
    ).resolves.toBe(true);
    expect(isMember).toHaveBeenCalledWith(teamId, userId);
  });

  it('responde 404 a quien no es coach de ese equipo', async () => {
    isMember.mockResolvedValue(false);

    await expect(
      guard.canActivate(contextFor({ user: { id: userId }, params: { teamId } })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza un teamId que no es UUIDv7 sin consultar la base de datos', async () => {
    await expect(
      guard.canActivate(contextFor({ user: { id: userId }, params: { teamId: 'mi-equipo' } })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(isMember).not.toHaveBeenCalled();
  });

  it('exige que haya un usuario autenticado', async () => {
    await expect(guard.canActivate(contextFor({ params: { teamId } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
