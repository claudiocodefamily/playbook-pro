import { newId } from '@playbook/shared';
import request from 'supertest';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface PlaybookBody {
  id: string;
  teamId: string;
  name: string;
  side: string;
  description: string;
  playCount: number;
}

describe('Playbooks (e2e)', () => {
  let testApp: TestApp;

  const http = () => request(testApp.app.getHttpServer());

  const setupTeam = async (): Promise<{ coach: TestCoach; teamId: string; url: string }> => {
    const coach = await registerCoach(testApp.app);
    const response = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamId = (response.body as { id: string }).id;
    return { coach, teamId, url: `/api/teams/${teamId}/playbooks` };
  };

  const createPlaybook = async (
    url: string,
    coach: TestCoach,
    body: Record<string, unknown> = { name: 'Ofensiva 2026', side: 'offense' },
  ): Promise<PlaybookBody> => {
    const response = await http().post(url).set(coach.auth).send(body).expect(201);
    return response.body as PlaybookBody;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('exige login', async () => {
    await http().get(`/api/teams/${newId()}/playbooks`).expect(401);
  });

  it('crea un playbook vacío del equipo de la URL', async () => {
    const { coach, teamId, url } = await setupTeam();

    const playbook = await createPlaybook(url, coach, {
      name: '  Ofensiva 2026 ',
      side: 'offense',
    });

    expect(playbook).toMatchObject({
      teamId,
      name: 'Ofensiva 2026',
      side: 'offense',
      description: '',
      playCount: 0,
    });
    const fetched = await http().get(`${url}/${playbook.id}`).set(coach.auth).expect(200);
    expect(fetched.body).toEqual(playbook);
  });

  it('rechaza datos inválidos', async () => {
    const { coach, url } = await setupTeam();
    const post = (body: Record<string, unknown>) => http().post(url).set(coach.auth).send(body);

    await post({ side: 'offense' }).expect(400);
    await post({ name: '   ', side: 'offense' }).expect(400);
    await post({ name: 'Ofensiva', side: 'goalline' }).expect(400);
    await post({ name: 'x'.repeat(101), side: 'offense' }).expect(400);
    await post({ name: 'Ofensiva', side: 'offense', teamId: newId() }).expect(400);
  });

  it('lista por unidad y cuenta las jugadas', async () => {
    const { coach, url } = await setupTeam();
    const offense = await createPlaybook(url, coach, { name: 'Ofensiva', side: 'offense' });
    await createPlaybook(url, coach, { name: 'Defensa', side: 'defense' });
    await http()
      .post(`${url}/${offense.id}/plays`)
      .set(coach.auth)
      .send({ name: 'Mesh' })
      .expect(201);

    const all = await http().get(url).set(coach.auth).expect(200);
    expect((all.body as PlaybookBody[]).map(({ name, playCount }) => [name, playCount])).toEqual([
      ['Defensa', 0],
      ['Ofensiva', 1],
    ]);

    const defense = await http().get(`${url}?side=defense`).set(coach.auth).expect(200);
    expect((defense.body as PlaybookBody[]).map(({ name }) => name)).toEqual(['Defensa']);
  });

  it('edita el nombre y la descripción', async () => {
    const { coach, url } = await setupTeam();
    const playbook = await createPlaybook(url, coach);

    const response = await http()
      .patch(`${url}/${playbook.id}`)
      .set(coach.auth)
      .send({ name: 'Ofensiva base', description: 'Lo que entra en el primer partido' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: playbook.id,
      name: 'Ofensiva base',
      description: 'Lo que entra en el primer partido',
      side: 'offense',
    });
  });

  it('al borrar el playbook se ocultan él y sus jugadas', async () => {
    const { coach, teamId, url } = await setupTeam();
    const playbook = await createPlaybook(url, coach);
    const play = await http()
      .post(`${url}/${playbook.id}/plays`)
      .set(coach.auth)
      .send({ name: 'Mesh' })
      .expect(201);
    const playId = (play.body as { id: string }).id;

    await http().delete(`${url}/${playbook.id}`).set(coach.auth).expect(204);

    await http().get(`${url}/${playbook.id}`).set(coach.auth).expect(404);
    await http().delete(`${url}/${playbook.id}`).set(coach.auth).expect(404);
    await http().get(`/api/teams/${teamId}/plays/${playId}`).set(coach.auth).expect(404);
    const list = await http().get(url).set(coach.auth).expect(200);
    expect(list.body).toEqual([]);
  });

  it('un equipo no ve ni toca los playbooks de otro', async () => {
    const owner = await setupTeam();
    const stranger = await setupTeam();
    const playbook = await createPlaybook(owner.url, owner.coach);

    await http().get(owner.url).set(stranger.coach.auth).expect(404);
    await http().get(`${stranger.url}/${playbook.id}`).set(stranger.coach.auth).expect(404);
    await http()
      .patch(`${stranger.url}/${playbook.id}`)
      .set(stranger.coach.auth)
      .send({ name: 'Robado' })
      .expect(404);
    await http().delete(`${stranger.url}/${playbook.id}`).set(stranger.coach.auth).expect(404);
    await http()
      .post(`${stranger.url}/${playbook.id}/plays`)
      .set(stranger.coach.auth)
      .send({ name: 'Intrusa' })
      .expect(404);

    const list = await http().get(stranger.url).set(stranger.coach.auth).expect(200);
    expect(list.body).toEqual([]);
  });
});
