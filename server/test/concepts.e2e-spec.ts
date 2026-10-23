import { newId } from '@playbook/shared';
import request from 'supertest';
import { GLOBAL_CONCEPTS } from '../src/database/seeds/concepts.seed.js';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface ConceptBody {
  id: string;
  teamId: string | null;
  isGlobal: boolean;
  name: string;
  side: string;
  explanation: string;
  playCount: number;
}

interface PlayBody {
  id: string;
  name: string;
  conceptIds: string[];
  version: number;
}

const Y_CROSS = {
  name: 'Y-Cross',
  side: 'offense',
  explanation: 'El TE cruza el campo a 15 yardas por detrás de los linebackers.',
};

describe('Concepts (e2e)', () => {
  let testApp: TestApp;

  const http = () => request(testApp.app.getHttpServer());

  interface Setup {
    coach: TestCoach;
    teamUrl: string;
    url: string;
  }

  const setupTeam = async (): Promise<Setup> => {
    const coach = await registerCoach(testApp.app);
    const response = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamUrl = `/api/teams/${(response.body as { id: string }).id}`;
    return { coach, teamUrl, url: `${teamUrl}/concepts` };
  };

  const createPlay = async (setup: Setup, body: Record<string, unknown>): Promise<PlayBody> => {
    const playbook = await http()
      .post(`${setup.teamUrl}/playbooks`)
      .set(setup.coach.auth)
      .send({ name: 'Ataque', side: 'offense' })
      .expect(201);
    const play = await http()
      .post(`${setup.teamUrl}/playbooks/${(playbook.body as { id: string }).id}/plays`)
      .set(setup.coach.auth)
      .send(body)
      .expect(201);
    return play.body as PlayBody;
  };

  const globalConcept = async (setup: Setup, name: string): Promise<ConceptBody> => {
    const list = await http().get(setup.url).set(setup.coach.auth).expect(200);
    const concept = (list.body as ConceptBody[]).find((candidate) => candidate.name === name);
    if (!concept) throw new Error(`falta el concepto global ${name}`);
    return concept;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('exige login', async () => {
    await http().get(`/api/teams/${newId()}/concepts`).expect(401);
  });

  it('carga al arrancar el glosario global, visible para cualquier equipo', async () => {
    const setup = await setupTeam();
    const response = await http().get(setup.url).set(setup.coach.auth).expect(200);
    const concepts = response.body as ConceptBody[];
    expect(concepts.map(({ name }) => name).sort()).toEqual(
      GLOBAL_CONCEPTS.map(({ name }) => name).sort(),
    );
    expect(concepts.every((concept) => concept.isGlobal && concept.playCount === 0)).toBe(true);

    const defense = await http().get(`${setup.url}?side=defense`).set(setup.coach.auth).expect(200);
    expect((defense.body as ConceptBody[]).every((concept) => concept.side === 'defense')).toBe(
      true,
    );
    await http().get(`${setup.url}?side=goalline`).set(setup.coach.auth).expect(400);
  });

  it('crea, edita y borra un concepto propio; no repite nombre', async () => {
    const setup = await setupTeam();
    const created = await http().post(setup.url).set(setup.coach.auth).send(Y_CROSS).expect(201);
    const concept = created.body as ConceptBody;
    expect(concept).toMatchObject({ name: 'Y-Cross', isGlobal: false, playCount: 0 });

    await http()
      .post(setup.url)
      .set(setup.coach.auth)
      .send({ ...Y_CROSS, name: 'y-cross' })
      .expect(409);

    const updated = await http()
      .patch(`${setup.url}/${concept.id}`)
      .set(setup.coach.auth)
      .send({ explanation: 'Cruce profundo del TE.' })
      .expect(200);
    expect((updated.body as ConceptBody).explanation).toBe('Cruce profundo del TE.');

    await http().delete(`${setup.url}/${concept.id}`).set(setup.coach.auth).expect(204);
    await http().get(`${setup.url}/${concept.id}`).set(setup.coach.auth).expect(404);
  });

  it('rechaza conceptos inválidos', async () => {
    const setup = await setupTeam();
    const post = (body: Record<string, unknown>) =>
      http().post(setup.url).set(setup.coach.auth).send(body);
    await post({ ...Y_CROSS, name: '  ' }).expect(400);
    await post({ ...Y_CROSS, side: 'goalline' }).expect(400);
    await post({ ...Y_CROSS, explanation: 'x'.repeat(2001) }).expect(400);
    await post({ ...Y_CROSS, teamId: newId() }).expect(400);
  });

  it('no deja editar ni borrar los conceptos globales', async () => {
    const setup = await setupTeam();
    const mesh = await globalConcept(setup, 'Mesh');
    await http()
      .patch(`${setup.url}/${mesh.id}`)
      .set(setup.coach.auth)
      .send({ name: 'Mío' })
      .expect(409);
    await http().delete(`${setup.url}/${mesh.id}`).set(setup.coach.auth).expect(409);
  });

  it('enlaza conceptos a las jugadas, los cuenta y lista sus jugadas', async () => {
    const setup = await setupTeam();
    const mesh = await globalConcept(setup, 'Mesh');
    const own = (await http().post(setup.url).set(setup.coach.auth).send(Y_CROSS).expect(201))
      .body as ConceptBody;

    const play = await createPlay(setup, { name: 'Mesh Right', conceptIds: [mesh.id] });
    expect(play.conceptIds).toEqual([mesh.id]);

    const patched = await http()
      .patch(`${setup.teamUrl}/plays/${play.id}`)
      .set(setup.coach.auth)
      .send({ version: play.version, conceptIds: [mesh.id, own.id] })
      .expect(200);
    expect((patched.body as PlayBody).conceptIds).toEqual([mesh.id, own.id]);

    const counted = await globalConcept(setup, 'Mesh');
    expect(counted.playCount).toBe(1);
    const plays = await http()
      .get(`${setup.url}/${mesh.id}/plays`)
      .set(setup.coach.auth)
      .expect(200);
    expect((plays.body as PlayBody[]).map(({ name }) => name)).toEqual(['Mesh Right']);

    // Al borrar el concepto propio, desaparece de la jugada.
    await http().delete(`${setup.url}/${own.id}`).set(setup.coach.auth).expect(204);
    const reloaded = await http()
      .get(`${setup.teamUrl}/plays/${play.id}`)
      .set(setup.coach.auth)
      .expect(200);
    expect((reloaded.body as PlayBody).conceptIds).toEqual([mesh.id]);
  });

  it('rechaza enlazar conceptos que no existen, repetidos o de otro equipo', async () => {
    const owner = await setupTeam();
    const stranger = await setupTeam();
    const foreign = (await http().post(owner.url).set(owner.coach.auth).send(Y_CROSS).expect(201))
      .body as ConceptBody;
    const mesh = await globalConcept(stranger, 'Mesh');
    const play = await createPlay(stranger, { name: 'Slant' });
    const patch = (conceptIds: unknown) =>
      http()
        .patch(`${stranger.teamUrl}/plays/${play.id}`)
        .set(stranger.coach.auth)
        .send({ version: play.version, conceptIds });

    await patch([foreign.id]).expect(400);
    await patch([newId()]).expect(400);
    await patch([mesh.id, mesh.id]).expect(400);
    await patch(['no-es-un-uuid']).expect(400);
    await patch([mesh.id]).expect(200);
  });

  it('un equipo no ve ni toca los conceptos de otro', async () => {
    const owner = await setupTeam();
    const stranger = await setupTeam();
    const { id } = (await http().post(owner.url).set(owner.coach.auth).send(Y_CROSS).expect(201))
      .body as ConceptBody;

    await http().get(`${stranger.url}/${id}`).set(stranger.coach.auth).expect(404);
    await http().get(`${stranger.url}/${id}/plays`).set(stranger.coach.auth).expect(404);
    await http()
      .patch(`${stranger.url}/${id}`)
      .set(stranger.coach.auth)
      .send({ name: 'X' })
      .expect(404);
    await http().delete(`${stranger.url}/${id}`).set(stranger.coach.auth).expect(404);
    await http().get(owner.url).set(stranger.coach.auth).expect(404);
    const list = await http().get(stranger.url).set(stranger.coach.auth).expect(200);
    expect((list.body as ConceptBody[]).some((concept) => concept.id === id)).toBe(false);
  });
});
