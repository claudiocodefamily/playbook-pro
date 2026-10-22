import { newId } from '@playbook/shared';
import request from 'supertest';
import { GLOBAL_FORMATIONS } from '../src/database/seeds/formations.seed.js';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface FormationBody {
  id: string;
  teamId: string | null;
  isGlobal: boolean;
  name: string;
  side: string;
  players: { slotId: string; position: string; label: string; x: number; y: number }[];
}

const TRIPS = {
  name: 'Trips Right',
  side: 'offense',
  players: [
    { slotId: 'C', position: 'OL', label: 'C', x: 0, y: -1 },
    { slotId: 'QB', position: 'QB', label: 'QB', x: 0, y: -5 },
    { slotId: 'Z', position: 'WR', label: 'Z', x: 20, y: -1 },
  ],
};

describe('Formations (e2e)', () => {
  let testApp: TestApp;

  const http = () => request(testApp.app.getHttpServer());

  const setupTeam = async (): Promise<{ coach: TestCoach; url: string }> => {
    const coach = await registerCoach(testApp.app);
    const response = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    return { coach, url: `/api/teams/${(response.body as { id: string }).id}/formations` };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('exige login', async () => {
    await http().get(`/api/teams/${newId()}/formations`).expect(401);
  });

  it('carga al arrancar las formaciones globales, visibles para cualquier equipo', async () => {
    const { coach, url } = await setupTeam();

    const response = await http().get(url).set(coach.auth).expect(200);
    const formations = response.body as FormationBody[];

    expect(formations.map(({ side, name }) => `${side}/${name}`).sort()).toEqual(
      GLOBAL_FORMATIONS.map(({ side, name }) => `${side}/${name}`).sort(),
    );
    expect(formations.every((formation) => formation.isGlobal && formation.teamId === null)).toBe(
      true,
    );
    const shotgun = formations.find((formation) => formation.name === 'Shotgun');
    expect(shotgun?.players).toHaveLength(11);
  });

  it('filtra por unidad', async () => {
    const { coach, url } = await setupTeam();
    const response = await http().get(`${url}?side=defense`).set(coach.auth).expect(200);
    const names = (response.body as FormationBody[]).map((formation) => formation.name);
    expect(names).toEqual(['3-4', '4-3', 'Dime', 'Nickel']);
    await http().get(`${url}?side=goalline`).set(coach.auth).expect(400);
  });

  it('crea, edita y borra una formación propia, que sale antes que las globales', async () => {
    const { coach, url } = await setupTeam();

    const created = await http().post(url).set(coach.auth).send(TRIPS).expect(201);
    const formation = created.body as FormationBody;
    expect(formation).toMatchObject({ name: 'Trips Right', isGlobal: false, side: 'offense' });
    expect(formation.players).toEqual(TRIPS.players);

    const list = await http().get(url).set(coach.auth).expect(200);
    expect((list.body as FormationBody[])[0]?.id).toBe(formation.id);

    const updated = await http()
      .patch(`${url}/${formation.id}`)
      .set(coach.auth)
      .send({ name: 'Trips Left' })
      .expect(200);
    expect((updated.body as FormationBody).name).toBe('Trips Left');

    await http().delete(`${url}/${formation.id}`).set(coach.auth).expect(204);
    await http().get(`${url}/${formation.id}`).set(coach.auth).expect(404);
  });

  it('rechaza formaciones inválidas', async () => {
    const { coach, url } = await setupTeam();
    const post = (body: Record<string, unknown>) => http().post(url).set(coach.auth).send(body);
    const slot = TRIPS.players[0];

    await post({ ...TRIPS, players: [] }).expect(400);
    await post({
      ...TRIPS,
      players: Array.from({ length: 12 }, (_, i) => ({ ...slot, slotId: `S${i}` })),
    }).expect(400);
    await post({ ...TRIPS, players: [slot, slot] }).expect(400);
    await post({ ...TRIPS, players: [{ ...slot, x: 40 }] }).expect(400);
    await post({ ...TRIPS, players: [{ ...slot, label: 'LARGO' }] }).expect(400);
    await post({ ...TRIPS, players: [{ ...slot, position: 'GK' }] }).expect(400);
    await post({ ...TRIPS, teamId: newId() }).expect(400);
  });

  it('no permite dos formaciones con el mismo nombre en la misma unidad', async () => {
    const { coach, url } = await setupTeam();
    await http().post(url).set(coach.auth).send(TRIPS).expect(201);
    await http().post(url).set(coach.auth).send(TRIPS).expect(409);
    await http()
      .post(url)
      .set(coach.auth)
      .send({ ...TRIPS, side: 'special' })
      .expect(201);
  });

  it('no deja editar ni borrar las formaciones globales', async () => {
    const { coach, url } = await setupTeam();
    const list = await http().get(url).set(coach.auth).expect(200);
    const global = (list.body as FormationBody[])[0];
    if (!global) throw new Error('faltan las formaciones globales');

    await http().patch(`${url}/${global.id}`).set(coach.auth).send({ name: 'Mía' }).expect(409);
    await http().delete(`${url}/${global.id}`).set(coach.auth).expect(409);
  });

  it('un equipo no ve ni toca las formaciones de otro', async () => {
    const owner = await setupTeam();
    const stranger = await setupTeam();
    const created = await http().post(owner.url).set(owner.coach.auth).send(TRIPS).expect(201);
    const { id } = created.body as FormationBody;

    await http().get(`${stranger.url}/${id}`).set(stranger.coach.auth).expect(404);
    await http()
      .patch(`${stranger.url}/${id}`)
      .set(stranger.coach.auth)
      .send({ name: 'X' })
      .expect(404);
    await http().delete(`${stranger.url}/${id}`).set(stranger.coach.auth).expect(404);
    await http().get(owner.url).set(stranger.coach.auth).expect(404);

    const list = await http().get(stranger.url).set(stranger.coach.auth).expect(200);
    expect((list.body as FormationBody[]).some((formation) => formation.id === id)).toBe(false);
  });
});
