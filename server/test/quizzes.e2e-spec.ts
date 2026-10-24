import {
  createEmptyDiagram,
  newId,
  type PlayDiagram,
  type QuizQuestionView,
} from '@playbook/shared';
import request from 'supertest';
import { createTestApp, registerCoach, type TestApp, type TestCoach } from './create-test-app.js';

interface Setup {
  coach: TestCoach;
  teamUrl: string;
  playbookId: string;
  rosterId: string;
}

interface QuizBody {
  id: string;
  title: string;
  questionCount: number;
  visibleToPlayers: boolean;
  myAttempts: number;
  myBest: { correct: number; total: number } | null;
  questions: QuizQuestionView[];
}

interface ResultBody {
  correct: number;
  total: number;
  results: {
    questionId: string;
    optionId: string | null;
    correctOptionId: string;
    isCorrect: boolean;
  }[];
}

/** X con un slant y Z con un go: dos preguntas de WR. */
function meshDiagram(): PlayDiagram {
  const x = { id: newId(), side: 'O', position: 'WR', label: 'X', x: -20, y: 0 } as const;
  const z = { id: newId(), side: 'O', position: 'WR', label: 'Z', x: 20, y: -1 } as const;
  const qb = { id: newId(), side: 'O', position: 'QB', label: 'QB', x: 0, y: -5 } as const;
  const route = (playerId: string, end: { x: number; y: number }) => ({
    id: newId(),
    playerId,
    type: 'route' as const,
    points: [end],
    style: { line: 'solid' as const, end: 'arrow' as const, curved: false },
    startTime: 0,
    endTime: 2,
  });
  return {
    ...createEmptyDiagram(),
    players: [x, z, qb],
    assignments: [route(x.id, { x: -15, y: 6 }), route(z.id, { x: 20, y: 20 })],
  };
}

describe('Quizzes (e2e)', () => {
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
    const playbookId = (playbook.body as { id: string }).id;
    await http()
      .post(`${teamUrl}/playbooks/${playbookId}/plays`)
      .set(coach.auth)
      .send({ name: 'Mesh Right', diagram: meshDiagram() })
      .expect(201);
    const roster = await http()
      .post(`${teamUrl}/roster`)
      .set(coach.auth)
      .send({ name: 'Juan Pérez', number: 12, positions: ['WR'] })
      .expect(201);
    return { coach, teamUrl, playbookId, rosterId: (roster.body as { id: string }).id };
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

  const createQuiz = async (s: Setup): Promise<QuizBody> => {
    const response = await http()
      .post(`${s.teamUrl}/quizzes`)
      .set(s.coach.auth)
      .send({ title: ' Repaso WR ', playbookId: s.playbookId, positions: ['WR'] })
      .expect(201);
    return response.body as QuizBody;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it('crea preguntas a partir de las jugadas dibujadas', async () => {
    const s = await setup();
    const quiz = await createQuiz(s);

    expect(quiz).toMatchObject({ title: 'Repaso WR', questionCount: 2, visibleToPlayers: false });
    expect(quiz.questions.map((question) => question.prompt)).toEqual([
      '¿Qué hace X (WR) en «Mesh Right»?',
      '¿Qué hace Z (WR) en «Mesh Right»?',
    ]);
    // El coach ve las respuestas.
    expect(quiz.questions.every((question) => question.correctOptionId)).toBe(true);

    // Sin tareas para esa posición no hay quiz.
    await http()
      .post(`${s.teamUrl}/quizzes`)
      .set(s.coach.auth)
      .send({ title: 'LB', playbookId: s.playbookId, positions: ['LB'] })
      .expect(400);
    await http()
      .post(`${s.teamUrl}/quizzes`)
      .set(s.coach.auth)
      .send({ title: 'X', playbookId: s.playbookId, positions: ['XX'] })
      .expect(400);
    await http()
      .post(`${s.teamUrl}/quizzes`)
      .set(s.coach.auth)
      .send({ title: 'X', playbookId: newId(), positions: ['WR'] })
      .expect(404);
  });

  it('dice cuántas preguntas saldrían por posición, solo al coach', async () => {
    const s = await setup();
    const url = `${s.teamUrl}/quizzes/coverage?playbookId=${s.playbookId}`;

    const coverage = await http().get(url).set(s.coach.auth).expect(200);
    expect(coverage.body).toEqual({ positions: [{ position: 'WR', questions: 2 }] });

    await http()
      .get(`${s.teamUrl}/quizzes/coverage?playbookId=no-es-uuid`)
      .set(s.coach.auth)
      .expect(400);
    await http()
      .get(`${s.teamUrl}/quizzes/coverage?playbookId=${newId()}`)
      .set(s.coach.auth)
      .expect(404);
    const player = await joinedPlayer(s);
    await http().get(url).set(player.auth).expect(403);
  });

  it('el coach añade y quita preguntas de texto', async () => {
    const s = await setup();
    const quiz = await createQuiz(s);
    const url = `${s.teamUrl}/quizzes/${quiz.id}`;

    await http()
      .post(`${url}/questions`)
      .set(s.coach.auth)
      .send({ prompt: '¿Contra Cover 2?', options: ['Sí', 'No'], correctIndex: 2 })
      .expect(400);
    const added = await http()
      .post(`${url}/questions`)
      .set(s.coach.auth)
      .send({
        prompt: ' ¿Contra Cover 2? ',
        options: ['Hot route', ' Sigo la ruta '],
        correctIndex: 1,
      })
      .expect(201);
    const withText = added.body as QuizBody;
    const text = withText.questions.at(-1);
    expect(withText.questionCount).toBe(3);
    expect(text).toMatchObject({ kind: 'text', prompt: '¿Contra Cover 2?' });
    if (text?.kind !== 'text') throw new Error('falta la pregunta de texto');
    expect(text.options.map((option) => option.text)).toEqual(['Hot route', 'Sigo la ruta']);
    expect(text.correctOptionId).toBe(text.options[1]?.id);

    const removed = await http()
      .delete(`${url}/questions/${text.id}`)
      .set(s.coach.auth)
      .expect(200);
    expect((removed.body as QuizBody).questionCount).toBe(2);
    await http().delete(`${url}/questions/${text.id}`).set(s.coach.auth).expect(404);
  });

  it('el jugador solo ve los publicados, sin respuestas, y recibe su nota', async () => {
    const s = await setup();
    const quiz = await createQuiz(s);
    const url = `${s.teamUrl}/quizzes/${quiz.id}`;
    const player = await joinedPlayer(s);

    const hidden = await http().get(`${s.teamUrl}/quizzes`).set(player.auth).expect(200);
    expect(hidden.body).toEqual([]);
    await http().get(url).set(player.auth).expect(404);
    await http().post(`${url}/attempts`).set(player.auth).send({ answers: [] }).expect(404);

    // Lo que solo puede hacer un coach.
    await http().patch(url).set(player.auth).send({ visibleToPlayers: true }).expect(403);
    await http()
      .post(`${s.teamUrl}/quizzes`)
      .set(player.auth)
      .send({ title: 'X', playbookId: s.playbookId, positions: ['WR'] })
      .expect(403);

    await http().patch(url).set(s.coach.auth).send({ visibleToPlayers: true }).expect(200);
    const listed = await http().get(`${s.teamUrl}/quizzes`).set(player.auth).expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ id: quiz.id, questionCount: 2, myAttempts: 0, myBest: null }),
    ]);
    const seen = (await http().get(url).set(player.auth).expect(200)).body as QuizBody;
    expect(seen.questions.some((question) => 'correctOptionId' in question)).toBe(false);

    // Acierta la primera y deja la segunda sin responder.
    const [first, second] = quiz.questions;
    if (!first?.correctOptionId || !second) throw new Error('faltan preguntas');
    const result = await http()
      .post(`${url}/attempts`)
      .set(player.auth)
      .send({ answers: [{ questionId: first.id, optionId: first.correctOptionId }] })
      .expect(201);
    expect(result.body).toMatchObject({ correct: 1, total: 2 });
    expect((result.body as ResultBody).results).toEqual([
      {
        questionId: first.id,
        optionId: first.correctOptionId,
        correctOptionId: first.correctOptionId,
        isCorrect: true,
      },
      {
        questionId: second.id,
        optionId: null,
        correctOptionId: second.correctOptionId,
        isCorrect: false,
      },
    ]);

    // Un segundo intento peor no baja la mejor nota.
    await http().post(`${url}/attempts`).set(player.auth).send({ answers: [] }).expect(201);
    const after = await http().get(`${s.teamUrl}/quizzes`).set(player.auth).expect(200);
    expect(after.body).toEqual([
      expect.objectContaining({ myAttempts: 2, myBest: { correct: 1, total: 2 } }),
    ]);
  });

  it('el coach ve la nota de cada jugador y los aciertos por pregunta', async () => {
    const s = await setup();
    const quiz = await createQuiz(s);
    const url = `${s.teamUrl}/quizzes/${quiz.id}`;
    await http().patch(url).set(s.coach.auth).send({ visibleToPlayers: true }).expect(200);
    const player = await joinedPlayer(s);
    const [first, second] = quiz.questions;
    if (!first?.correctOptionId || !second?.correctOptionId) throw new Error('faltan preguntas');

    const empty = await http().get(`${url}/results`).set(s.coach.auth).expect(200);
    expect(empty.body).toEqual({
      players: [
        expect.objectContaining({
          rosterPlayerId: s.rosterId,
          name: 'Juan',
          attempts: 0,
          best: null,
          last: null,
        }),
      ],
      questions: [
        { questionId: first.id, answered: 0, correct: 0 },
        { questionId: second.id, answered: 0, correct: 0 },
      ],
    });

    // Primero acierta las dos; luego solo la segunda. Cuenta su último intento.
    const answer = (questionId: string, optionId: string) => ({ questionId, optionId });
    await http()
      .post(`${url}/attempts`)
      .set(player.auth)
      .send({
        answers: [
          answer(first.id, first.correctOptionId),
          answer(second.id, second.correctOptionId),
        ],
      })
      .expect(201);
    await http()
      .post(`${url}/attempts`)
      .set(player.auth)
      .send({ answers: [answer(second.id, second.correctOptionId)] })
      .expect(201);
    // Los intentos del coach (al probarlo) no cuentan.
    await http().post(`${url}/attempts`).set(s.coach.auth).send({ answers: [] }).expect(201);

    const results = await http().get(`${url}/results`).set(s.coach.auth).expect(200);
    expect(results.body).toEqual({
      players: [
        expect.objectContaining({
          name: 'Juan',
          attempts: 2,
          best: { correct: 2, total: 2 },
          last: expect.objectContaining({ correct: 1, total: 2 }),
        }),
      ],
      questions: [
        { questionId: first.id, answered: 1, correct: 0 },
        { questionId: second.id, answered: 1, correct: 1 },
      ],
    });
    await http().get(`${url}/results`).set(player.auth).expect(403);
  });

  it('aísla los quizzes por equipo y borra los intentos con el quiz', async () => {
    const s = await setup();
    const quiz = await createQuiz(s);
    const other = await registerCoach(testApp.app, 'Otro coach');

    await http().get(`${s.teamUrl}/quizzes/${quiz.id}`).set(other.auth).expect(404);
    await http().delete(`${s.teamUrl}/quizzes/${quiz.id}`).set(s.coach.auth).expect(204);
    await http().get(`${s.teamUrl}/quizzes/${quiz.id}`).set(s.coach.auth).expect(404);
    await http().delete(`${s.teamUrl}/quizzes/${quiz.id}`).set(s.coach.auth).expect(404);
  });
});
