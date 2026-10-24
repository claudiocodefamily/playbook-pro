import { DEFAULT_GAME_PLAN_SITUATIONS, newId } from '@playbook/shared';
import request from 'supertest';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface Setup {
  coach: TestCoach;
  teamUrl: string;
  playbookId: string;
  rosterId: string;
}

interface PlanBody {
  id: string;
  opponent: string;
  gameDate: string | null;
  playCount: number;
  visibleToPlayers: boolean;
  situations: { id: string; name: string; playIds: string[] }[];
  plays: { id: string; name: string; playbookId: string; playbookName: string }[];
}

describe('Game plans (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  const setup = async (): Promise<Setup> => {
    const coach = await registerCoach(testApp.app, 'Coach Taylor');
    const team = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamUrl = `/api/teams/${(team.body as { id: string }).id}`;
    const playbook = await http()
      .post(`${teamUrl}/playbooks`)
      .set(coach.auth)
      .send({ name: 'Ofensiva', side: 'offense' })
      .expect(201);
    const roster = await http()
      .post(`${teamUrl}/roster`)
      .set(coach.auth)
      .send({ name: 'Juan Pérez', number: 12, positions: ['WR'] })
      .expect(201);
    return {
      coach,
      teamUrl,
      playbookId: (playbook.body as { id: string }).id,
      rosterId: (roster.body as { id: string }).id,
    };
  };

  const createPlay = async (s: Setup, name: string, playbookId = s.playbookId) => {
    const response = await http()
      .post(`${s.teamUrl}/playbooks/${playbookId}/plays`)
      .set(s.coach.auth)
      .send({ name })
      .expect(201);
    return (response.body as { id: string }).id;
  };

  const createPlan = async (s: Setup, body: Record<string, unknown> = { opponent: 'Halcones' }) => {
    const response = await http()
      .post(`${s.teamUrl}/game-plans`)
      .set(s.coach.auth)
      .send(body)
      .expect(201);
    return response.body as PlanBody;
  };

  const joinedPlayer = async (s: Setup): Promise<TestCoach> => {
    const invite = await http()
      .post(`${s.teamUrl}/roster/${s.rosterId}/invite`)
      .set(s.coach.auth)
      .expect(201);
    const player = await registerCoach(testApp.app, 'Juan');
    await http()
      .post(`/api/invites/${(invite.body as { token: string }).token}/accept`)
      .set(player.auth)
      .expect(200);
    return player;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('nace con las situaciones típicas, vacías y oculto', async () => {
    const s = await setup();
    const plan = await createPlan(s, { opponent: ' Halcones ', gameDate: '2026-11-07' });

    expect(plan).toMatchObject({
      opponent: 'Halcones',
      gameDate: '2026-11-07',
      playCount: 0,
      visibleToPlayers: false,
      plays: [],
    });
    expect(plan.situations.map((situation) => situation.name)).toEqual([
      ...DEFAULT_GAME_PLAN_SITUATIONS,
    ]);

    await http()
      .post(`${s.teamUrl}/game-plans`)
      .set(s.coach.auth)
      .send({ opponent: '' })
      .expect(400);
    await http()
      .post(`${s.teamUrl}/game-plans`)
      .set(s.coach.auth)
      .send({ opponent: 'X', gameDate: '7/11/2026' })
      .expect(400);
  });

  it('el coach pone jugadas en las situaciones, las ordena y cambia la fecha', async () => {
    const s = await setup();
    const plan = await createPlan(s);
    const mesh = await createPlay(s, 'Mesh Right');
    const verts = await createPlay(s, 'Four Verticals');
    const url = `${s.teamUrl}/game-plans/${plan.id}`;
    const [first, second] = plan.situations;
    if (!first || !second) throw new Error('faltan situaciones');

    const extra = { id: newId(), name: 'Trick plays', playIds: [verts] };
    const updated = await http()
      .patch(url)
      .set(s.coach.auth)
      .send({
        gameDate: '2026-11-14',
        situations: [{ ...first, playIds: [verts, mesh] }, { ...second, name: ' 3rd & 2 ' }, extra],
      })
      .expect(200);
    const body = updated.body as PlanBody;
    expect(body.gameDate).toBe('2026-11-14');
    expect(body.playCount).toBe(3);
    expect(body.situations).toEqual([
      { id: first.id, name: first.name, playIds: [verts, mesh] },
      { id: second.id, name: '3rd & 2', playIds: [] },
      extra,
    ]);
    expect(body.plays).toEqual(
      expect.arrayContaining([
        { id: mesh, name: 'Mesh Right', playbookId: s.playbookId, playbookName: 'Ofensiva' },
      ]),
    );

    // Jugadas que no existen, repetidas o de otro equipo: rechazadas.
    const bad = (playIds: string[]) =>
      http()
        .patch(url)
        .set(s.coach.auth)
        .send({ situations: [{ ...first, playIds }] })
        .expect(400);
    await bad([newId()]);
    await bad([mesh, mesh]);
    const other = await setup();
    await bad([await createPlay(other, 'Ajena')]);

    // Sin fecha.
    const undated = await http().patch(url).set(s.coach.auth).send({ gameDate: null }).expect(200);
    expect((undated.body as PlanBody).gameDate).toBeNull();

    // Si se borra una jugada, desaparece del game plan.
    await http().delete(`${s.teamUrl}/plays/${verts}`).set(s.coach.auth).expect(204);
    const after = (await http().get(url).set(s.coach.auth).expect(200)).body as PlanBody;
    expect(after.situations[0]?.playIds).toEqual([mesh]);
    expect(after.playCount).toBe(1);
  });

  it('el jugador solo ve los publicados y solo las jugadas de playbooks visibles', async () => {
    const s = await setup();
    const plan = await createPlan(s);
    const visibleId = await createPlay(s, 'Mesh Right');
    const hiddenBook = await http()
      .post(`${s.teamUrl}/playbooks`)
      .set(s.coach.auth)
      .send({ name: 'Secreto', side: 'offense' })
      .expect(201);
    const hiddenId = await createPlay(s, 'Truco', (hiddenBook.body as { id: string }).id);
    await http()
      .patch(`${s.teamUrl}/playbooks/${s.playbookId}`)
      .set(s.coach.auth)
      .send({ visibleToPlayers: true })
      .expect(200);
    const url = `${s.teamUrl}/game-plans/${plan.id}`;
    const [first] = plan.situations;
    if (!first) throw new Error('faltan situaciones');
    await http()
      .patch(url)
      .set(s.coach.auth)
      .send({ situations: [{ ...first, playIds: [visibleId, hiddenId] }] })
      .expect(200);
    const player = await joinedPlayer(s);

    expect((await http().get(`${s.teamUrl}/game-plans`).set(player.auth).expect(200)).body).toEqual(
      [],
    );
    await http().get(url).set(player.auth).expect(404);
    await http().patch(url).set(player.auth).send({ visibleToPlayers: true }).expect(403);

    await http().patch(url).set(s.coach.auth).send({ visibleToPlayers: true }).expect(200);
    const listed = await http().get(`${s.teamUrl}/game-plans`).set(player.auth).expect(200);
    expect(listed.body).toEqual([expect.objectContaining({ id: plan.id, playCount: 1 })]);
    const seen = (await http().get(url).set(player.auth).expect(200)).body as PlanBody;
    expect(seen.situations[0]?.playIds).toEqual([visibleId]);
    expect(seen.plays.map((play) => play.name)).toEqual(['Mesh Right']);
  });

  it('aísla por equipo y se puede borrar', async () => {
    const s = await setup();
    const plan = await createPlan(s);
    const other = await registerCoach(testApp.app, 'Otro');

    await http().get(`${s.teamUrl}/game-plans/${plan.id}`).set(other.auth).expect(404);
    await http().delete(`${s.teamUrl}/game-plans/${plan.id}`).set(s.coach.auth).expect(204);
    await http().delete(`${s.teamUrl}/game-plans/${plan.id}`).set(s.coach.auth).expect(404);
  });
});
