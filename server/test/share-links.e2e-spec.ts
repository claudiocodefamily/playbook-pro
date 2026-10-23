import { getModelToken } from '@nestjs/mongoose';
import { newId } from '@playbook/shared';
import type { Model } from 'mongoose';
import request from 'supertest';
import { ShareLink } from '../src/modules/share-links/schemas/share-link.schema.js';
import { hashSecretToken } from '../src/common/utils/secret-token.js';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface LinkBody {
  id: string;
  playbookId: string;
  label: string;
  expiresAt: string | null;
  token?: string;
}

interface SharedBody {
  teamName: string;
  ruleset: string;
  name: string;
  side: string;
  plays: { id: string; name: string; conceptIds: string[]; diagram: { schemaVersion: number } }[];
  concepts: { id: string; name: string; explanation: string }[];
}

describe('Share links (e2e)', () => {
  let testApp: TestApp;

  const http = () => request(testApp.app.getHttpServer());

  interface Setup {
    coach: TestCoach;
    teamUrl: string;
    playbookUrl: string;
    url: string;
  }

  const setup = async (): Promise<Setup> => {
    const coach = await registerCoach(testApp.app);
    const team = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamUrl = `/api/teams/${(team.body as { id: string }).id}`;
    const playbook = await http()
      .post(`${teamUrl}/playbooks`)
      .set(coach.auth)
      .send({ name: 'Ofensiva 2026', side: 'offense' })
      .expect(201);
    const playbookUrl = `${teamUrl}/playbooks/${(playbook.body as { id: string }).id}`;
    return { coach, teamUrl, playbookUrl, url: `${playbookUrl}/share-links` };
  };

  const createLink = async (s: Setup, body: Record<string, unknown> = {}): Promise<LinkBody> =>
    (await http().post(s.url).set(s.coach.auth).send(body).expect(201)).body as LinkBody;

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('crea un link con un token secreto que solo se ve al crearlo', async () => {
    const s = await setup();
    const link = await createLink(s, { label: ' Receptores ', expiresInDays: 30 });
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link.label).toBe('Receptores');
    expect(new Date(link.expiresAt ?? 0).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    const list = await http().get(s.url).set(s.coach.auth).expect(200);
    expect(list.body).toEqual([expect.not.objectContaining({ token: expect.anything() })]);

    // En la base de datos solo está el hash.
    const model = testApp.app.get<Model<ShareLink>>(getModelToken(ShareLink.name));
    const stored = await model.findById(link.id).lean().exec();
    expect(stored?.tokenHash).toBe(hashSecretToken(link.token ?? ''));
    expect(JSON.stringify(stored)).not.toContain(link.token);
  });

  it('cualquiera con el link ve el playbook y sus jugadas sin login', async () => {
    const s = await setup();
    const concepts = await http().get(`${s.teamUrl}/concepts`).set(s.coach.auth).expect(200);
    const mesh = (concepts.body as { id: string; name: string }[]).find((c) => c.name === 'Mesh');
    await http()
      .post(`${s.playbookUrl}/plays`)
      .set(s.coach.auth)
      .send({ name: 'Mesh Right', conceptIds: [mesh?.id] })
      .expect(201);
    await http()
      .post(`${s.playbookUrl}/plays`)
      .set(s.coach.auth)
      .send({ name: 'Slant' })
      .expect(201);
    const { token } = await createLink(s);

    const shared = await http().get(`/api/shared/${token}`).expect(200);
    const body = shared.body as SharedBody;
    expect(body).toMatchObject({ teamName: 'Lobos', name: 'Ofensiva 2026', side: 'offense' });
    expect(body.plays.map((play) => play.name)).toEqual(['Mesh Right', 'Slant']);
    expect(body.plays[0]?.diagram.schemaVersion).toBeGreaterThan(0);
    expect(body.concepts.map((concept) => concept.name)).toEqual(['Mesh']);
    expect(JSON.stringify(body)).not.toMatch(/createdBy|teamId|email/);
  });

  it('un link revocado, caducado, inventado o de un playbook borrado no abre', async () => {
    const s = await setup();
    const revoked = await createLink(s);
    await http().delete(`${s.url}/${revoked.id}`).set(s.coach.auth).expect(204);
    await http().get(`/api/shared/${revoked.token}`).expect(404);
    await http().delete(`${s.url}/${revoked.id}`).set(s.coach.auth).expect(404);

    const expired = await createLink(s, { expiresInDays: 1 });
    const model = testApp.app.get<Model<ShareLink>>(getModelToken(ShareLink.name));
    await model.updateOne({ _id: expired.id }, { expiresAt: new Date(Date.now() - 1000) }).exec();
    await http().get(`/api/shared/${expired.token}`).expect(404);
    const list = await http().get(s.url).set(s.coach.auth).expect(200);
    expect(list.body).toEqual([]);

    await http()
      .get(`/api/shared/${'a'.repeat(43)}`)
      .expect(404);
    await http().get('/api/shared/corto').expect(404);

    const live = await createLink(s);
    await http().delete(s.playbookUrl).set(s.coach.auth).expect(204);
    await http().get(`/api/shared/${live.token}`).expect(404);
  });

  it('valida la caducidad', async () => {
    const s = await setup();
    await http().post(s.url).set(s.coach.auth).send({ expiresInDays: 0 }).expect(400);
    await http().post(s.url).set(s.coach.auth).send({ expiresInDays: 400 }).expect(400);
    await http().post(s.url).set(s.coach.auth).send({ expiresInDays: 1.5 }).expect(400);
    const forever = await createLink(s, { expiresInDays: null });
    expect(forever.expiresAt).toBeNull();
  });

  it('solo los coaches del equipo crean, ven y revocan los links', async () => {
    const owner = await setup();
    const stranger = await setup();
    const link = await createLink(owner);
    const otherUrl = owner.url;

    await http().post(otherUrl).send({}).expect(401);
    await http().post(otherUrl).set(stranger.coach.auth).send({}).expect(404);
    await http().get(otherUrl).set(stranger.coach.auth).expect(404);
    await http().delete(`${otherUrl}/${link.id}`).set(stranger.coach.auth).expect(404);
    // Ni con su propio equipo puede tocar un link de otro.
    await http().delete(`${stranger.url}/${link.id}`).set(stranger.coach.auth).expect(404);
    await http()
      .get(`${owner.teamUrl}/playbooks/${newId()}/share-links`)
      .set(owner.coach.auth)
      .expect(404);
    await http().get(`/api/shared/${link.token}`).expect(200);
  });
});
