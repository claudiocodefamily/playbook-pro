import { newId } from '@playbook/shared';
import request from 'supertest';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface TeamBody {
  id: string;
  name: string;
  ruleset: string;
  logoUrl?: string;
  memberCount: number;
}

interface MemberBody {
  userId: string;
  name: string;
  email: string;
  role: string;
}

describe('Teams (e2e)', () => {
  let testApp: TestApp;

  const http = () => request(testApp.app.getHttpServer());
  const coach = (name?: string) => registerCoach(testApp.app, name);
  const createTeam = async (owner: TestCoach, name = 'Lobos'): Promise<TeamBody> => {
    const response = await http().post('/api/teams').set(owner.auth).send({ name }).expect(201);
    return response.body as TeamBody;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('exige login', async () => {
    await http().get('/api/teams').expect(401);
    await http().post('/api/teams').send({ name: 'Lobos' }).expect(401);
  });

  describe('crear y consultar', () => {
    it('quien crea el equipo queda como su único coach, con reglamento college por defecto', async () => {
      const owner = await coach('Coach Taylor');

      const team = await createTeam(owner, '  Lobos de Monterrey  ');

      expect(team).toMatchObject({
        name: 'Lobos de Monterrey',
        ruleset: 'college',
        memberCount: 1,
      });
      const members = await http().get(`/api/teams/${team.id}/members`).set(owner.auth).expect(200);
      expect(members.body).toEqual([
        expect.objectContaining({ userId: owner.id, email: owner.email, role: 'COACH' }),
      ]);
    });

    it('rechaza datos inválidos', async () => {
      const owner = await coach();

      await http().post('/api/teams').set(owner.auth).send({ name: '   ' }).expect(400);
      await http()
        .post('/api/teams')
        .set(owner.auth)
        .send({ name: 'Lobos', ruleset: 'xfl' })
        .expect(400);
      await http()
        .post('/api/teams')
        .set(owner.auth)
        .send({ name: 'Lobos', logoUrl: 'http://sin-https.com/logo.png' })
        .expect(400);
      await http()
        .post('/api/teams')
        .set(owner.auth)
        .send({ name: 'Lobos', members: [{ userId: newId() }] })
        .expect(400);
    });

    it('la lista solo incluye mis equipos', async () => {
      const owner = await coach();
      const stranger = await coach();
      const mine = await createTeam(owner, 'Águilas');
      await createTeam(stranger, 'Halcones');

      const response = await http().get('/api/teams').set(owner.auth).expect(200);

      expect((response.body as TeamBody[]).map((team) => team.id)).toEqual([mine.id]);
    });

    it('edita solo los campos enviados y permite quitar el logo con null', async () => {
      const owner = await coach();
      const team = await createTeam(owner);
      const url = `/api/teams/${team.id}`;

      const withLogo = await http()
        .patch(url)
        .set(owner.auth)
        .send({ ruleset: 'nfl', logoUrl: 'https://example.com/logo.png' })
        .expect(200);
      expect(withLogo.body).toMatchObject({
        name: 'Lobos',
        ruleset: 'nfl',
        logoUrl: 'https://example.com/logo.png',
      });

      const renamed = await http()
        .patch(url)
        .set(owner.auth)
        .send({ name: 'Lobos Plateados', logoUrl: null })
        .expect(200);
      expect(renamed.body).toMatchObject({ name: 'Lobos Plateados', ruleset: 'nfl' });
      expect((renamed.body as TeamBody).logoUrl).toBeUndefined();
    });
  });

  describe('aislamiento entre equipos', () => {
    it('un coach de otro equipo recibe 404 en todas las rutas del equipo', async () => {
      const owner = await coach();
      const stranger = await coach();
      const team = await createTeam(owner);
      const url = `/api/teams/${team.id}`;

      await http().get(url).set(stranger.auth).expect(404);
      await http().patch(url).set(stranger.auth).send({ name: 'Robado' }).expect(404);
      await http().get(`${url}/members`).set(stranger.auth).expect(404);
      await http()
        .post(`${url}/members`)
        .set(stranger.auth)
        .send({ email: stranger.email })
        .expect(404);
      await http().delete(`${url}/members/${owner.id}`).set(stranger.auth).expect(404);

      const untouched = await http().get(url).set(owner.auth).expect(200);
      expect(untouched.body).toMatchObject({ name: 'Lobos', memberCount: 1 });
    });

    it('responde 404 si el equipo no existe y 400 si el id no es UUIDv7', async () => {
      const owner = await coach();

      await http().get(`/api/teams/${newId()}`).set(owner.auth).expect(404);
      await http().get('/api/teams/507f1f77bcf86cd799439011').set(owner.auth).expect(400);
    });
  });

  describe('coaches del equipo', () => {
    it('añade a otro coach por su email y desde entonces puede entrar', async () => {
      const owner = await coach('Head Coach');
      const coordinator = await coach('Coordinador');
      const team = await createTeam(owner);
      const url = `/api/teams/${team.id}`;

      const response = await http()
        .post(`${url}/members`)
        .set(owner.auth)
        .send({ email: coordinator.email.toUpperCase() })
        .expect(201);

      expect((response.body as MemberBody[]).map((member) => member.userId)).toEqual([
        owner.id,
        coordinator.id,
      ]);
      await http().get(url).set(coordinator.auth).expect(200);
    });

    it('no añade dos veces al mismo coach ni a un email sin cuenta', async () => {
      const owner = await coach();
      const team = await createTeam(owner);
      const url = `/api/teams/${team.id}/members`;

      await http().post(url).set(owner.auth).send({ email: owner.email }).expect(409);
      await http().post(url).set(owner.auth).send({ email: 'nadie@equipo.com' }).expect(404);
      await http().post(url).set(owner.auth).send({ email: 'no-es-un-email' }).expect(400);
    });

    it('quita a un coach, que pierde el acceso al equipo', async () => {
      const owner = await coach();
      const coordinator = await coach();
      const team = await createTeam(owner);
      const url = `/api/teams/${team.id}`;
      await http()
        .post(`${url}/members`)
        .set(owner.auth)
        .send({ email: coordinator.email })
        .expect(201);

      await http().delete(`${url}/members/${coordinator.id}`).set(owner.auth).expect(204);

      await http().get(url).set(coordinator.auth).expect(404);
      const members = await http().get(`${url}/members`).set(owner.auth).expect(200);
      expect((members.body as MemberBody[]).map((member) => member.userId)).toEqual([owner.id]);
    });

    it('nunca deja al equipo sin coaches', async () => {
      const owner = await coach();
      const team = await createTeam(owner);
      const url = `/api/teams/${team.id}/members`;

      await http().delete(`${url}/${owner.id}`).set(owner.auth).expect(409);
      await http().delete(`${url}/${newId()}`).set(owner.auth).expect(404);

      const members = await http().get(url).set(owner.auth).expect(200);
      expect(members.body).toHaveLength(1);
    });
  });
});
