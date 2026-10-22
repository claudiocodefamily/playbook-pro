import { newId } from '@playbook/shared';
import request from 'supertest';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface PlayerBody {
  id: string;
  teamId: string;
  name: string;
  number: number;
  positions: string[];
  photoUrl?: string;
  active: boolean;
}

describe('Roster (e2e)', () => {
  let testApp: TestApp;

  const http = () => request(testApp.app.getHttpServer());

  /** Crea un coach con su equipo y devuelve la URL base del roster. */
  const setupTeam = async (): Promise<{ coach: TestCoach; teamId: string; rosterUrl: string }> => {
    const coach = await registerCoach(testApp.app);
    const response = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamId = (response.body as { id: string }).id;
    return { coach, teamId, rosterUrl: `/api/teams/${teamId}/roster` };
  };

  const addPlayer = async (
    rosterUrl: string,
    coach: TestCoach,
    player: Record<string, unknown>,
  ): Promise<PlayerBody> => {
    const response = await http().post(rosterUrl).set(coach.auth).send(player).expect(201);
    return response.body as PlayerBody;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('exige login', async () => {
    await http().get(`/api/teams/${newId()}/roster`).expect(401);
  });

  describe('alta y consulta', () => {
    it('añade un jugador al equipo de la URL, activo y sin posiciones por defecto', async () => {
      const { coach, teamId, rosterUrl } = await setupTeam();

      const player = await addPlayer(rosterUrl, coach, { name: '  Carlos Ramírez ', number: 12 });

      expect(player).toMatchObject({
        teamId,
        name: 'Carlos Ramírez',
        number: 12,
        positions: [],
        active: true,
      });
      const fetched = await http().get(`${rosterUrl}/${player.id}`).set(coach.auth).expect(200);
      expect(fetched.body).toEqual(player);
    });

    it('rechaza datos inválidos y no deja elegir el equipo en el cuerpo', async () => {
      const { coach, rosterUrl } = await setupTeam();
      const post = (body: Record<string, unknown>) =>
        http().post(rosterUrl).set(coach.auth).send(body);

      await post({ number: 12 }).expect(400);
      await post({ name: 'Carlos', number: 100 }).expect(400);
      await post({ name: 'Carlos', number: 1.5 }).expect(400);
      await post({ name: 'Carlos', number: 12, positions: ['GOALKEEPER'] }).expect(400);
      await post({ name: 'Carlos', number: 12, positions: ['QB', 'QB'] }).expect(400);
      await post({ name: 'Carlos', number: 12, photoUrl: 'javascript:alert(1)' }).expect(400);
      await post({ name: 'Carlos', number: 12, teamId: newId() }).expect(400);
    });

    it('permite dorsales repetidos y lista ordenando por dorsal', async () => {
      const { coach, rosterUrl } = await setupTeam();
      await addPlayer(rosterUrl, coach, { name: 'Zeta', number: 88, positions: ['WR'] });
      await addPlayer(rosterUrl, coach, { name: 'Beto', number: 7, positions: ['QB'] });
      await addPlayer(rosterUrl, coach, { name: 'Abel', number: 7, positions: ['CB', 'S'] });

      const response = await http().get(rosterUrl).set(coach.auth).expect(200);

      expect((response.body as PlayerBody[]).map((player) => player.name)).toEqual([
        'Abel',
        'Beto',
        'Zeta',
      ]);
    });

    it('filtra por jugadores activos o inactivos', async () => {
      const { coach, rosterUrl } = await setupTeam();
      await addPlayer(rosterUrl, coach, { name: 'Activo', number: 1 });
      await addPlayer(rosterUrl, coach, { name: 'Retirado', number: 2, active: false });
      const names = async (query: string) =>
        (
          (await http().get(`${rosterUrl}${query}`).set(coach.auth).expect(200))
            .body as PlayerBody[]
        ).map((player) => player.name);

      expect(await names('?active=true')).toEqual(['Activo']);
      expect(await names('?active=false')).toEqual(['Retirado']);
      expect(await names('')).toEqual(['Activo', 'Retirado']);
      await http().get(`${rosterUrl}?active=quizas`).set(coach.auth).expect(400);
    });
  });

  describe('editar y borrar', () => {
    it('edita solo los campos enviados y permite quitar la foto con null', async () => {
      const { coach, rosterUrl } = await setupTeam();
      const player = await addPlayer(rosterUrl, coach, {
        name: 'Carlos',
        number: 12,
        positions: ['QB'],
        photoUrl: 'https://example.com/carlos.jpg',
      });
      const url = `${rosterUrl}/${player.id}`;

      const updated = await http()
        .patch(url)
        .set(coach.auth)
        .send({ number: 9, active: false, photoUrl: null })
        .expect(200);

      expect(updated.body).toMatchObject({
        name: 'Carlos',
        number: 9,
        positions: ['QB'],
        active: false,
      });
      expect((updated.body as PlayerBody).photoUrl).toBeUndefined();
      await http().patch(url).set(coach.auth).send({ number: 150 }).expect(400);
    });

    it('borra un jugador', async () => {
      const { coach, rosterUrl } = await setupTeam();
      const player = await addPlayer(rosterUrl, coach, { name: 'Carlos', number: 12 });
      const url = `${rosterUrl}/${player.id}`;

      await http().delete(url).set(coach.auth).expect(204);

      await http().get(url).set(coach.auth).expect(404);
      await http().delete(url).set(coach.auth).expect(404);
    });

    it('responde 400 si el id del jugador no es UUIDv7', async () => {
      const { coach, rosterUrl } = await setupTeam();

      await http().get(`${rosterUrl}/12`).set(coach.auth).expect(400);
    });
  });

  describe('aislamiento entre equipos', () => {
    it('un coach de otro equipo no puede ver ni tocar el roster', async () => {
      const lobos = await setupTeam();
      const rival = await setupTeam();
      const player = await addPlayer(lobos.rosterUrl, lobos.coach, { name: 'Carlos', number: 12 });
      const url = `${lobos.rosterUrl}/${player.id}`;

      await http().get(lobos.rosterUrl).set(rival.coach.auth).expect(404);
      await http()
        .post(lobos.rosterUrl)
        .set(rival.coach.auth)
        .send({ name: 'Espía', number: 0 })
        .expect(404);
      await http().get(url).set(rival.coach.auth).expect(404);
      await http().patch(url).set(rival.coach.auth).send({ name: 'Hackeado' }).expect(404);
      await http().delete(url).set(rival.coach.auth).expect(404);

      const untouched = await http().get(lobos.rosterUrl).set(lobos.coach.auth).expect(200);
      expect(untouched.body).toEqual([player]);
    });

    it('no se llega al jugador de otro equipo usando la URL del equipo propio', async () => {
      const lobos = await setupTeam();
      const rival = await setupTeam();
      const player = await addPlayer(lobos.rosterUrl, lobos.coach, { name: 'Carlos', number: 12 });
      const crossUrl = `${rival.rosterUrl}/${player.id}`;

      await http().get(crossUrl).set(rival.coach.auth).expect(404);
      await http().patch(crossUrl).set(rival.coach.auth).send({ name: 'Hackeado' }).expect(404);
      await http().delete(crossUrl).set(rival.coach.auth).expect(404);

      const fetched = await http()
        .get(`${lobos.rosterUrl}/${player.id}`)
        .set(lobos.coach.auth)
        .expect(200);
      expect(fetched.body).toMatchObject({ name: 'Carlos' });
    });
  });
});
