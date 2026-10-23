import { newId } from '@playbook/shared';
import request from 'supertest';
import { createTestApp, registerCoach, type TestApp } from './create-test-app.js';

describe('Uploads (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('exige login y ser coach del equipo', async () => {
    await http().post(`/api/teams/${newId()}/uploads/roster-photo`).expect(401);

    const owner = await registerCoach(testApp.app);
    const stranger = await registerCoach(testApp.app);
    const team = await http()
      .post('/api/teams')
      .set(owner.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamId = (team.body as { id: string }).id;
    await http().post(`/api/teams/${teamId}/uploads/roster-photo`).set(stranger.auth).expect(404);
  });

  it('sin Cloudinary configurado responde 503 con un mensaje para el coach', async () => {
    const coach = await registerCoach(testApp.app);
    const team = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamId = (team.body as { id: string }).id;

    const response = await http()
      .post(`/api/teams/${teamId}/uploads/roster-photo`)
      .set(coach.auth)
      .expect(503);
    expect((response.body as { message: string }).message).toMatch(/pega la URL/);
  });
});
