import request from 'supertest';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface Setup {
  coach: TestCoach;
  teamId: string;
  teamUrl: string;
  rosterId: string;
}

describe('Cuentas de jugadores (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  const setup = async (): Promise<Setup> => {
    const coach = await registerCoach(testApp.app, 'Coach Taylor');
    const team = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamId = (team.body as { id: string }).id;
    const teamUrl = `/api/teams/${teamId}`;
    const roster = await http()
      .post(`${teamUrl}/roster`)
      .set(coach.auth)
      .send({ name: 'Juan Pérez', number: 12, positions: ['WR'] })
      .expect(201);
    return { coach, teamId, teamUrl, rosterId: (roster.body as { id: string }).id };
  };

  const invite = async (s: Setup, rosterId = s.rosterId): Promise<string> => {
    const response = await http()
      .post(`${s.teamUrl}/roster/${rosterId}/invite`)
      .set(s.coach.auth)
      .expect(201);
    return (response.body as { token: string }).token;
  };

  /** Un jugador con cuenta en el equipo de `s`. */
  const joinedPlayer = async (s: Setup): Promise<TestCoach> => {
    const token = await invite(s);
    const player = await registerCoach(testApp.app, 'Juan');
    await http().post(`/api/invites/${token}/accept`).set(player.auth).expect(200);
    return player;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('el jugador abre la invitación, entra al equipo y ve su ficha', async () => {
    const s = await setup();
    const token = await invite(s);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const preview = await http().get(`/api/invites/${token}`).expect(200);
    expect(preview.body).toMatchObject({ teamName: 'Lobos', playerName: 'Juan Pérez', number: 12 });

    const player = await registerCoach(testApp.app, 'Juan');
    await http().post(`/api/invites/${token}/accept`).expect(401);
    const accepted = await http().post(`/api/invites/${token}/accept`).set(player.auth).expect(200);
    expect(accepted.body).toEqual({ teamId: s.teamId });

    // Un solo uso.
    await http().get(`/api/invites/${token}`).expect(404);
    const other = await registerCoach(testApp.app, 'Otro');
    await http().post(`/api/invites/${token}/accept`).set(other.auth).expect(404);

    const teams = await http().get('/api/teams').set(player.auth).expect(200);
    expect(teams.body).toEqual([
      expect.objectContaining({ id: s.teamId, myRole: 'PLAYER', memberCount: 1 }),
    ]);
    const me = await http().get(`${s.teamUrl}/me`).set(player.auth).expect(200);
    expect(me.body).toEqual({
      role: 'PLAYER',
      rosterPlayer: { id: s.rosterId, name: 'Juan Pérez', number: 12, positions: ['WR'] },
    });
    const coachMe = await http().get(`${s.teamUrl}/me`).set(s.coach.auth).expect(200);
    expect(coachMe.body).toEqual({ role: 'COACH', rosterPlayer: null });

    // El coach ve quién tiene cuenta; la lista de coaches no incluye al jugador.
    const access = await http().get(`${s.teamUrl}/player-accounts`).set(s.coach.auth).expect(200);
    expect(access.body).toEqual([
      {
        rosterPlayerId: s.rosterId,
        account: expect.objectContaining({ userId: player.id, name: 'Juan' }),
        inviteExpiresAt: null,
      },
    ]);
    const members = await http().get(`${s.teamUrl}/members`).set(s.coach.auth).expect(200);
    expect((members.body as { role: string }[]).map((member) => member.role)).toEqual(['COACH']);
  });

  it('el jugador solo ve los playbooks visibles y no puede cambiar nada', async () => {
    const s = await setup();
    const player = await joinedPlayer(s);
    const createPlaybook = async (name: string, visibleToPlayers: boolean) =>
      (
        await http()
          .post(`${s.teamUrl}/playbooks`)
          .set(s.coach.auth)
          .send({ name, side: 'offense', visibleToPlayers })
          .expect(201)
      ).body as { id: string; visibleToPlayers: boolean };
    const visible = await createPlaybook('Base', true);
    const hidden = await createPlaybook('Game plan', false);
    expect(visible.visibleToPlayers).toBe(true);
    const playIn = async (playbookId: string) =>
      (
        (
          await http()
            .post(`${s.teamUrl}/playbooks/${playbookId}/plays`)
            .set(s.coach.auth)
            .send({ name: 'Mesh' })
            .expect(201)
        ).body as { id: string }
      ).id;
    const visiblePlay = await playIn(visible.id);
    const hiddenPlay = await playIn(hidden.id);

    const list = await http().get(`${s.teamUrl}/playbooks`).set(player.auth).expect(200);
    expect((list.body as { name: string }[]).map((playbook) => playbook.name)).toEqual(['Base']);
    await http().get(`${s.teamUrl}/playbooks/${visible.id}`).set(player.auth).expect(200);
    await http().get(`${s.teamUrl}/playbooks/${hidden.id}`).set(player.auth).expect(404);
    await http().get(`${s.teamUrl}/playbooks/${visible.id}/plays`).set(player.auth).expect(200);
    await http().get(`${s.teamUrl}/playbooks/${hidden.id}/plays`).set(player.auth).expect(404);
    await http().get(`${s.teamUrl}/plays/${visiblePlay}`).set(player.auth).expect(200);
    await http().get(`${s.teamUrl}/plays/${hiddenPlay}`).set(player.auth).expect(404);
    await http().get(`${s.teamUrl}/concepts`).set(player.auth).expect(200);
    await http().get(s.teamUrl).set(player.auth).expect(200);

    // Todo lo que cambia datos, o no es para jugadores, responde 403.
    const forbidden = [
      () => http().patch(s.teamUrl).send({ name: 'Hackeado' }),
      () => http().post(`${s.teamUrl}/playbooks`).send({ name: 'X', side: 'offense' }),
      () => http().patch(`${s.teamUrl}/playbooks/${visible.id}`).send({ name: 'X' }),
      () => http().delete(`${s.teamUrl}/playbooks/${visible.id}`),
      () => http().patch(`${s.teamUrl}/plays/${visiblePlay}`).send({ version: 1, name: 'X' }),
      () => http().post(`${s.teamUrl}/plays/${visiblePlay}/duplicate`).send({}),
      () => http().get(`${s.teamUrl}/plays/${visiblePlay}/versions`),
      () => http().get(`${s.teamUrl}/roster`),
      () => http().get(`${s.teamUrl}/members`),
      () => http().post(`${s.teamUrl}/members`).send({ email: 'a@b.com' }),
      () => http().get(`${s.teamUrl}/player-accounts`),
      () => http().post(`${s.teamUrl}/roster/${s.rosterId}/invite`),
      () =>
        http()
          .post(`${s.teamUrl}/concepts`)
          .send({ name: 'Nuevo', side: 'offense', explanation: 'x' }),
      () => http().get(`${s.teamUrl}/formations`),
      () => http().post(`${s.teamUrl}/playbooks/${visible.id}/share-links`).send({}),
    ];
    for (const pending of forbidden) {
      await pending().set(player.auth).expect(403);
    }

    // El coach la oculta y el jugador deja de verla.
    await http()
      .patch(`${s.teamUrl}/playbooks/${visible.id}`)
      .set(s.coach.auth)
      .send({ visibleToPlayers: false })
      .expect(200);
    await http().get(`${s.teamUrl}/plays/${visiblePlay}`).set(player.auth).expect(404);
  });

  it('no se puede usar una invitación dos veces para la misma ficha ni siendo ya del equipo', async () => {
    const s = await setup();
    // El coach no puede aceptar una invitación de su propio equipo.
    const token = await invite(s);
    await http()
      .post(`/api/invites/${token}/accept`)
      .set(s.coach.auth)
      .expect(409, /Ya eres coach/);

    // Una invitación nueva anula la anterior.
    const second = await invite(s);
    await http().get(`/api/invites/${token}`).expect(404);
    await http().get(`/api/invites/${second}`).expect(200);
    const access = await http().get(`${s.teamUrl}/player-accounts`).set(s.coach.auth).expect(200);
    expect(access.body).toEqual([
      { rosterPlayerId: s.rosterId, account: null, inviteExpiresAt: expect.any(String) },
    ]);

    const player = await registerCoach(testApp.app, 'Juan');
    await http().post(`/api/invites/${second}/accept`).set(player.auth).expect(200);
    // Con cuenta ya no se puede invitar otra vez.
    await http().post(`${s.teamUrl}/roster/${s.rosterId}/invite`).set(s.coach.auth).expect(409);
    // Y un jugador no puede entrar como coach por email.
    await http()
      .post(`${s.teamUrl}/members`)
      .set(s.coach.auth)
      .send({ email: player.email })
      .expect(409, /como jugador/);

    await http().get('/api/invites/corto').expect(404);
    await http()
      .get(`/api/invites/${'a'.repeat(43)}`)
      .expect(404);
  });

  it('el coach quita el acceso; borrar la ficha del roster también lo quita', async () => {
    const s = await setup();
    const player = await joinedPlayer(s);
    await http().delete(`${s.teamUrl}/player-accounts/${s.rosterId}`).set(s.coach.auth).expect(204);
    await http().get(s.teamUrl).set(player.auth).expect(404);
    await http().delete(`${s.teamUrl}/player-accounts/${s.rosterId}`).set(s.coach.auth).expect(404);

    const again = await joinedPlayer(s);
    await http().get(s.teamUrl).set(again.auth).expect(200);
    await http().delete(`${s.teamUrl}/roster/${s.rosterId}`).set(s.coach.auth).expect(204);
    await http().get(s.teamUrl).set(again.auth).expect(404);
  });

  it('quitar coaches no toca a los jugadores y nunca deja el equipo sin coach', async () => {
    const s = await setup();
    const player = await joinedPlayer(s);
    // Con un jugador en el equipo, el coach sigue siendo el último coach.
    await http().delete(`${s.teamUrl}/members/${s.coach.id}`).set(s.coach.auth).expect(409);
    // A un jugador no se le quita por la ruta de coaches.
    await http().delete(`${s.teamUrl}/members/${player.id}`).set(s.coach.auth).expect(404);
  });

  it('otro equipo no puede invitar ni ver las cuentas', async () => {
    const owner = await setup();
    const stranger = await setup();
    await http()
      .post(`${stranger.teamUrl}/roster/${owner.rosterId}/invite`)
      .set(stranger.coach.auth)
      .expect(404);
    await http().get(`${owner.teamUrl}/player-accounts`).set(stranger.coach.auth).expect(404);
  });
});
