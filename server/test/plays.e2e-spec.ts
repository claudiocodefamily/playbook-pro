import {
  createEmptyDiagram,
  DIAGRAM_SCHEMA_VERSION,
  newId,
  type PlayDiagram,
} from '@playbook/shared';
import request from 'supertest';
import { MAX_VERSIONS_PER_PLAY } from '../src/modules/plays/plays.service.js';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface PlayBody {
  id: string;
  teamId: string;
  playbookId: string;
  name: string;
  formationId: string | null;
  tags: string[];
  version: number;
  createdBy: string;
  updatedBy: string;
  diagram?: PlayDiagram;
}

interface VersionBody {
  id: string;
  playId: string;
  version: number;
  name: string;
  diagram?: PlayDiagram;
}

/** Un slant del X con su pase: tiene referencias entre jugadores para probar la copia. */
function slantDiagram(): PlayDiagram {
  const qb = { id: newId(), side: 'O', position: 'QB', label: 'QB', x: 0, y: -5 } as const;
  const x = { id: newId(), side: 'O', position: 'WR', label: 'X', x: -20, y: -1 } as const;
  return {
    ...createEmptyDiagram(),
    players: [qb, x],
    assignments: [
      {
        id: newId(),
        playerId: x.id,
        type: 'route',
        routeName: 'slant',
        points: [
          { x: -20, y: 1 },
          { x: -14, y: 6 },
        ],
        style: { line: 'solid', end: 'arrow', curved: false },
        startTime: 0,
        endTime: 1.5,
      },
    ],
    ball: {
      carrierTimeline: [
        { t: 0, playerId: qb.id, action: 'snap' },
        { t: 1.5, playerId: x.id, action: 'pass' },
      ],
    },
  };
}

describe('Plays (e2e)', () => {
  let testApp: TestApp;

  const http = () => request(testApp.app.getHttpServer());

  interface Setup {
    coach: TestCoach;
    teamId: string;
    playbookId: string;
    /** /api/teams/:teamId */
    teamUrl: string;
    /** /api/teams/:teamId/playbooks/:playbookId/plays */
    playsUrl: string;
  }

  const setupTeam = async (): Promise<Setup> => {
    const coach = await registerCoach(testApp.app);
    const team = await http()
      .post('/api/teams')
      .set(coach.auth)
      .send({ name: 'Lobos' })
      .expect(201);
    const teamId = (team.body as { id: string }).id;
    const teamUrl = `/api/teams/${teamId}`;
    const playbook = await http()
      .post(`${teamUrl}/playbooks`)
      .set(coach.auth)
      .send({ name: 'Ofensiva', side: 'offense' })
      .expect(201);
    const playbookId = (playbook.body as { id: string }).id;
    return {
      coach,
      teamId,
      playbookId,
      teamUrl,
      playsUrl: `${teamUrl}/playbooks/${playbookId}/plays`,
    };
  };

  const createPlay = async (
    setup: Setup,
    body: Record<string, unknown> = { name: 'Slant' },
  ): Promise<PlayBody> => {
    const response = await http().post(setup.playsUrl).set(setup.coach.auth).send(body).expect(201);
    return response.body as PlayBody;
  };

  const patchPlay = (setup: Setup, playId: string, body: Record<string, unknown>) =>
    http().patch(`${setup.teamUrl}/plays/${playId}`).set(setup.coach.auth).send(body);

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('exige login', async () => {
    await http().get(`/api/teams/${newId()}/plays/${newId()}`).expect(401);
  });

  describe('crear', () => {
    it('crea una jugada vacía en la versión 1', async () => {
      const setup = await setupTeam();

      const play = await createPlay(setup, { name: ' Slant ', tags: [' Red Zone ', '3rd Down'] });

      expect(play).toMatchObject({
        teamId: setup.teamId,
        playbookId: setup.playbookId,
        name: 'Slant',
        formationId: null,
        tags: ['red zone', '3rd down'],
        version: 1,
        createdBy: setup.coach.id,
        updatedBy: setup.coach.id,
        diagram: createEmptyDiagram(),
      });
      const fetched = await http()
        .get(`${setup.teamUrl}/plays/${play.id}`)
        .set(setup.coach.auth)
        .expect(200);
      expect(fetched.body).toEqual(play);
    });

    it('coloca los jugadores según la formación elegida', async () => {
      const setup = await setupTeam();
      const formations = await http()
        .get(`${setup.teamUrl}/formations?side=offense`)
        .set(setup.coach.auth)
        .expect(200);
      const shotgun = (formations.body as { id: string; name: string }[]).find(
        (formation) => formation.name === 'Shotgun',
      );
      if (!shotgun) throw new Error('falta la formación Shotgun');

      const play = await createPlay(setup, { name: 'Mesh', formationId: shotgun.id });

      expect(play.formationId).toBe(shotgun.id);
      expect(play.diagram?.players).toHaveLength(11);
      expect(play.diagram?.players.every((player) => player.side === 'O')).toBe(true);
      expect(play.diagram?.players.find((player) => player.label === 'QB')).toMatchObject({
        x: 0,
        y: -5,
      });
    });

    it('guarda un diagram ya dibujado', async () => {
      const setup = await setupTeam();
      const diagram = slantDiagram();
      const play = await createPlay(setup, { name: 'Slant', diagram });
      expect(play.diagram).toEqual(diagram);
    });

    it('rechaza diagrams inválidos y formaciones o playbooks ajenos', async () => {
      const setup = await setupTeam();
      const other = await setupTeam();
      const otherFormation = await http()
        .post(`${other.teamUrl}/formations`)
        .set(other.coach.auth)
        .send({
          name: 'Secreta',
          side: 'offense',
          players: [{ slotId: 'QB', position: 'QB', label: 'QB', x: 0, y: -5 }],
        })
        .expect(201);
      const post = (body: Record<string, unknown>) =>
        http().post(setup.playsUrl).set(setup.coach.auth).send(body);

      await post({}).expect(400);
      // Una versión del esquema que aún no existe.
      await post({
        name: 'Slant',
        diagram: { ...createEmptyDiagram(), schemaVersion: DIAGRAM_SCHEMA_VERSION + 1 },
      }).expect(400);
      const broken = slantDiagram();
      const response = await post({
        name: 'Slant',
        diagram: { ...broken, players: broken.players.slice(1) },
      }).expect(400);
      expect(JSON.stringify(response.body)).toMatch(/portador del balón no existe/);
      await post({ name: 'Slant', formationId: 'shotgun' }).expect(400);
      await post({ name: 'Slant', tags: ['a', 'A'] }).expect(400);
      await post({ name: 'Slant', formationId: (otherFormation.body as { id: string }).id }).expect(
        404,
      );
      await http()
        .post(`${setup.teamUrl}/playbooks/${other.playbookId}/plays`)
        .set(setup.coach.auth)
        .send({ name: 'Slant' })
        .expect(404);
    });
  });

  describe('listar', () => {
    it('lista sin diagram, la editada más reciente primero, con filtros', async () => {
      const setup = await setupTeam();
      const mesh = await createPlay(setup, { name: 'Mesh Right', tags: ['3rd down'] });
      const slant = await createPlay(setup, { name: 'Slant', tags: ['red zone'] });
      await patchPlay(setup, mesh.id, { version: 1, name: 'Mesh Left' }).expect(200);

      const list = await http().get(setup.playsUrl).set(setup.coach.auth).expect(200);
      const plays = list.body as PlayBody[];
      expect(plays.map((play) => play.id)).toEqual([mesh.id, slant.id]);
      expect(plays.every((play) => play.diagram === undefined)).toBe(true);

      const byTag = await http()
        .get(`${setup.playsUrl}?tag=Red%20Zone`)
        .set(setup.coach.auth)
        .expect(200);
      expect((byTag.body as PlayBody[]).map((play) => play.id)).toEqual([slant.id]);

      const byText = await http().get(`${setup.playsUrl}?q=mesh`).set(setup.coach.auth).expect(200);
      expect((byText.body as PlayBody[]).map((play) => play.id)).toEqual([mesh.id]);
    });
  });

  describe('guardar', () => {
    it('aplica los cambios y sube la versión', async () => {
      const setup = await setupTeam();
      const play = await createPlay(setup);
      const diagram = slantDiagram();

      const response = await patchPlay(setup, play.id, {
        version: 1,
        name: 'Slant Flat',
        tags: ['Quick'],
        diagram,
      }).expect(200);

      expect(response.body).toMatchObject({
        name: 'Slant Flat',
        tags: ['quick'],
        version: 2,
        diagram,
      });
    });

    it('si otro coach guardó antes, responde 409 y no pisa su trabajo', async () => {
      const setup = await setupTeam();
      const play = await createPlay(setup);

      await patchPlay(setup, play.id, { version: 1, name: 'Del coach A' }).expect(200);
      const conflict = await patchPlay(setup, play.id, { version: 1, name: 'Del coach B' }).expect(
        409,
      );
      expect((conflict.body as { message: string }).message).toMatch(/versión actual: 2/);

      const fetched = await http()
        .get(`${setup.teamUrl}/plays/${play.id}`)
        .set(setup.coach.auth)
        .expect(200);
      expect(fetched.body).toMatchObject({ name: 'Del coach A', version: 2 });
    });

    it('exige la versión y valida el diagram', async () => {
      const setup = await setupTeam();
      const play = await createPlay(setup);

      await patchPlay(setup, play.id, { name: 'Sin versión' }).expect(400);
      await patchPlay(setup, play.id, { version: 1, diagram: { players: [] } }).expect(400);
      await patchPlay(setup, play.id, { version: 1, name: '' }).expect(400);
    });

    it('mueve la jugada a otro playbook y la desvincula de la formación', async () => {
      const setup = await setupTeam();
      const formations = await http()
        .get(`${setup.teamUrl}/formations`)
        .set(setup.coach.auth)
        .expect(200);
      const formationId = (formations.body as { id: string }[])[0]?.id;
      const play = await createPlay(setup, { name: 'Slant', formationId });
      const target = await http()
        .post(`${setup.teamUrl}/playbooks`)
        .set(setup.coach.auth)
        .send({ name: 'Red zone', side: 'offense' })
        .expect(201);
      const targetId = (target.body as { id: string }).id;

      const response = await patchPlay(setup, play.id, {
        version: 1,
        playbookId: targetId,
        formationId: null,
      }).expect(200);

      expect(response.body).toMatchObject({ playbookId: targetId, formationId: null });
      const oldList = await http().get(setup.playsUrl).set(setup.coach.auth).expect(200);
      expect(oldList.body).toEqual([]);
    });

    it('con saveVersion guarda una foto en el historial', async () => {
      const setup = await setupTeam();
      const play = await createPlay(setup);
      const diagram = slantDiagram();

      await patchPlay(setup, play.id, { version: 1, diagram, saveVersion: true }).expect(200);
      await patchPlay(setup, play.id, { version: 2, name: 'Autoguardado' }).expect(200);
      await patchPlay(setup, play.id, { version: 3, name: 'Slant v2', saveVersion: true }).expect(
        200,
      );

      const versionsUrl = `${setup.teamUrl}/plays/${play.id}/versions`;
      const list = await http().get(versionsUrl).set(setup.coach.auth).expect(200);
      const versions = list.body as VersionBody[];
      expect(versions.map(({ version, name }) => [version, name])).toEqual([
        [4, 'Slant v2'],
        [2, 'Slant'],
      ]);
      expect(versions.every((version) => version.diagram === undefined)).toBe(true);

      const second = await http().get(`${versionsUrl}/2`).set(setup.coach.auth).expect(200);
      expect((second.body as VersionBody).diagram).toEqual(diagram);
      await http().get(`${versionsUrl}/3`).set(setup.coach.auth).expect(404);
      await http().get(`${versionsUrl}/dos`).set(setup.coach.auth).expect(400);
    });

    it(`conserva solo las últimas ${MAX_VERSIONS_PER_PLAY} versiones`, async () => {
      const setup = await setupTeam();
      const play = await createPlay(setup);

      for (let version = 1; version <= MAX_VERSIONS_PER_PLAY + 2; version++) {
        await patchPlay(setup, play.id, { version, saveVersion: true }).expect(200);
      }

      const list = await http()
        .get(`${setup.teamUrl}/plays/${play.id}/versions`)
        .set(setup.coach.auth)
        .expect(200);
      const versions = (list.body as VersionBody[]).map(({ version }) => version);
      expect(versions).toHaveLength(MAX_VERSIONS_PER_PLAY);
      expect(versions[0]).toBe(MAX_VERSIONS_PER_PLAY + 3);
      expect(versions.at(-1)).toBe(4);
    }, 30_000);
  });

  describe('duplicar', () => {
    it('copia la jugada con ids nuevos, en la versión 1 y sin historial', async () => {
      const setup = await setupTeam();
      const original = await createPlay(setup, {
        name: 'Slant',
        tags: ['quick'],
        diagram: slantDiagram(),
      });
      await patchPlay(setup, original.id, { version: 1, saveVersion: true }).expect(200);

      const response = await http()
        .post(`${setup.teamUrl}/plays/${original.id}/duplicate`)
        .set(setup.coach.auth)
        .send({})
        .expect(201);
      const copy = response.body as PlayBody;

      expect(copy).toMatchObject({
        playbookId: setup.playbookId,
        name: 'Slant (copia)',
        tags: ['quick'],
        version: 1,
      });
      expect(copy.id).not.toBe(original.id);
      const originalIds = new Set(original.diagram?.players.map((player) => player.id));
      expect(copy.diagram?.players.some((player) => originalIds.has(player.id))).toBe(false);
      expect(copy.diagram?.assignments[0]?.playerId).toBe(copy.diagram?.players[1]?.id);

      const history = await http()
        .get(`${setup.teamUrl}/plays/${copy.id}/versions`)
        .set(setup.coach.auth)
        .expect(200);
      expect(history.body).toEqual([]);
    });

    it('duplica en otro playbook del equipo con otro nombre, pero no en uno ajeno', async () => {
      const setup = await setupTeam();
      const other = await setupTeam();
      const original = await createPlay(setup);
      const target = await http()
        .post(`${setup.teamUrl}/playbooks`)
        .set(setup.coach.auth)
        .send({ name: 'Red zone', side: 'offense' })
        .expect(201);
      const targetId = (target.body as { id: string }).id;
      const duplicateUrl = `${setup.teamUrl}/plays/${original.id}/duplicate`;

      const response = await http()
        .post(duplicateUrl)
        .set(setup.coach.auth)
        .send({ name: 'Slant Left', playbookId: targetId })
        .expect(201);
      expect(response.body).toMatchObject({ name: 'Slant Left', playbookId: targetId });

      await http()
        .post(duplicateUrl)
        .set(setup.coach.auth)
        .send({ playbookId: other.playbookId })
        .expect(404);
    });
  });

  it('borra la jugada (borrado lógico)', async () => {
    const setup = await setupTeam();
    const play = await createPlay(setup);
    const playUrl = `${setup.teamUrl}/plays/${play.id}`;

    await http().delete(playUrl).set(setup.coach.auth).expect(204);

    await http().get(playUrl).set(setup.coach.auth).expect(404);
    await http().delete(playUrl).set(setup.coach.auth).expect(404);
    await patchPlay(setup, play.id, { version: 1, name: 'Zombi' }).expect(404);
    const list = await http().get(setup.playsUrl).set(setup.coach.auth).expect(200);
    expect(list.body).toEqual([]);
  });

  it('un equipo no ve ni toca las jugadas de otro', async () => {
    const owner = await setupTeam();
    const stranger = await setupTeam();
    const play = await createPlay(owner);
    const strangerPlayUrl = `${stranger.teamUrl}/plays/${play.id}`;

    await http().get(`${owner.teamUrl}/plays/${play.id}`).set(stranger.coach.auth).expect(404);
    await http().get(strangerPlayUrl).set(stranger.coach.auth).expect(404);
    await patchPlay(stranger, play.id, { version: 1, name: 'Robada' }).expect(404);
    await http().delete(strangerPlayUrl).set(stranger.coach.auth).expect(404);
    await http().post(`${strangerPlayUrl}/duplicate`).set(stranger.coach.auth).send({}).expect(404);
    await http().get(`${strangerPlayUrl}/versions`).set(stranger.coach.auth).expect(404);
  });
});
