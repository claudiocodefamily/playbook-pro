import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  generateAssignmentQuestions,
  migrateDiagram,
  newId,
  QUIZ_MAX_QUESTIONS,
  type QuizQuestion,
  QuizQuestionSchema,
} from '@playbook/shared';
import type { Model } from 'mongoose';
import { toMongoUpdate } from '../../common/utils/mongo-update.js';
import { PlaybooksService, type Visibility } from '../playbooks/playbooks.service.js';
import { Play } from '../plays/schemas/play.schema.js';
import { TeamsService } from '../teams/teams.service.js';
import type { AddTextQuestionDto } from './dto/add-text-question.dto.js';
import type { CreateQuizDto } from './dto/create-quiz.dto.js';
import type { AttemptResultResponseDto, QuizScoreDto } from './dto/quiz-response.dto.js';
import type { QuizResultsResponseDto } from './dto/quiz-results-response.dto.js';
import type { SubmitAttemptDto } from './dto/submit-attempt.dto.js';
import type { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { QuizAttempt, type QuizAnswer } from './schemas/quiz-attempt.schema.js';
import { Quiz, type QuizDocument } from './schemas/quiz.schema.js';

const QUIZ_NOT_FOUND = 'Quiz no encontrado';

const visibilityFilter = ({ playersOnly = false }: Visibility) =>
  playersOnly ? { visibleToPlayers: true } : {};

export interface MyQuizStats {
  attempts: number;
  best: QuizScoreDto | null;
}

/** Todos los métodos filtran por `teamId`. */
@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(QuizAttempt.name) private readonly attemptModel: Model<QuizAttempt>,
    @InjectModel(Play.name) private readonly playModel: Model<Play>,
    private readonly playbooks: PlaybooksService,
    private readonly teams: TeamsService,
  ) {}

  /** Crea el quiz con preguntas sacadas de las jugadas dibujadas del playbook. */
  async create(teamId: string, userId: string, dto: CreateQuizDto): Promise<QuizDocument> {
    await this.playbooks.findOne(teamId, dto.playbookId);
    const plays = await this.playModel
      .find({
        teamId,
        playbookId: dto.playbookId,
        deletedAt: null,
        ...(dto.playIds ? { _id: { $in: dto.playIds } } : {}),
      })
      .sort({ name: 1 })
      .exec();
    const questions = generateAssignmentQuestions(
      plays.map((play) => ({
        id: play._id,
        name: play.name,
        diagram: migrateDiagram(play.diagram),
      })),
      { positions: dto.positions },
    );
    if (questions.length === 0) {
      throw new BadRequestException(
        'No hay jugadas con tareas dibujadas para esas posiciones. Dibuja sus rutas, bloqueos o zonas y vuelve a intentarlo.',
      );
    }
    return this.quizModel.create({
      teamId,
      playbookId: dto.playbookId,
      title: dto.title,
      questions: questions.map((question) => QuizQuestionSchema.parse(question)),
      createdBy: userId,
    });
  }

  /**
   * Los más nuevos primero. De las preguntas solo se trae el id (para contarlas): los
   * diagrams de cada pregunta pesan y el listado no los necesita.
   */
  findAll(teamId: string, visibility: Visibility = {}): Promise<QuizDocument[]> {
    return this.quizModel
      .find({ teamId, ...visibilityFilter(visibility) })
      .select({
        teamId: 1,
        playbookId: 1,
        title: 1,
        visibleToPlayers: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
        'questions.id': 1,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(
    teamId: string,
    quizId: string,
    visibility: Visibility = {},
  ): Promise<QuizDocument> {
    const quiz = await this.quizModel
      .findOne({ _id: quizId, teamId, ...visibilityFilter(visibility) })
      .exec();
    if (!quiz) throw new NotFoundException(QUIZ_NOT_FOUND);
    return quiz;
  }

  async update(teamId: string, quizId: string, dto: UpdateQuizDto): Promise<QuizDocument> {
    const quiz = await this.quizModel
      .findOneAndUpdate({ _id: quizId, teamId }, toMongoUpdate(dto), {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
    if (!quiz) throw new NotFoundException(QUIZ_NOT_FOUND);
    return quiz;
  }

  /** Borra el quiz y todos sus intentos. */
  async remove(teamId: string, quizId: string): Promise<void> {
    const result = await this.quizModel.deleteOne({ _id: quizId, teamId }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(QUIZ_NOT_FOUND);
    await this.attemptModel.deleteMany({ teamId, quizId }).exec();
  }

  async addTextQuestion(
    teamId: string,
    quizId: string,
    dto: AddTextQuestionDto,
  ): Promise<QuizDocument> {
    if (dto.correctIndex >= dto.options.length) {
      throw new BadRequestException('La respuesta correcta tiene que ser una de las opciones');
    }
    const options = dto.options.map((text) => ({ id: newId(), text }));
    const question: QuizQuestion = QuizQuestionSchema.parse({
      id: newId(),
      kind: 'text',
      prompt: dto.prompt,
      options,
      correctOptionId: options[dto.correctIndex]?.id,
    });
    // La condición del máximo va en el filtro: así dos coaches a la vez no lo pasan.
    const quiz = await this.quizModel
      .findOneAndUpdate(
        { _id: quizId, teamId, [`questions.${QUIZ_MAX_QUESTIONS - 1}`]: { $exists: false } },
        { $push: { questions: question } },
        { returnDocument: 'after' },
      )
      .exec();
    if (quiz) return quiz;
    await this.findOne(teamId, quizId);
    throw new BadRequestException(`Un quiz tiene como máximo ${QUIZ_MAX_QUESTIONS} preguntas`);
  }

  async removeQuestion(teamId: string, quizId: string, questionId: string): Promise<QuizDocument> {
    const quiz = await this.quizModel
      .findOneAndUpdate(
        { _id: quizId, teamId, 'questions.id': questionId },
        { $pull: { questions: { id: questionId } } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!quiz) throw new NotFoundException('Pregunta no encontrada');
    return quiz;
  }

  /** Corrige las respuestas y guarda el intento. Las que falten cuentan como falladas. */
  async submit(
    teamId: string,
    quizId: string,
    userId: string,
    dto: SubmitAttemptDto,
    visibility: Visibility = {},
  ): Promise<AttemptResultResponseDto> {
    const quiz = await this.findOne(teamId, quizId, visibility);
    const chosen = new Map(dto.answers.map((answer) => [answer.questionId, answer.optionId]));
    const answers: QuizAnswer[] = quiz.questions.map((question) => {
      const optionId = chosen.get(question.id) ?? null;
      return {
        questionId: question.id,
        optionId,
        isCorrect: optionId === question.correctOptionId,
      };
    });
    const attempt = await this.attemptModel.create({
      teamId,
      quizId,
      userId,
      answers,
      correct: answers.filter((answer) => answer.isCorrect).length,
      total: answers.length,
    });
    const correctOf = new Map(
      quiz.questions.map((question) => [question.id, question.correctOptionId]),
    );
    return {
      id: attempt._id,
      correct: attempt.correct,
      total: attempt.total,
      results: answers.map((answer) => ({
        ...answer,
        correctOptionId: correctOf.get(answer.questionId) ?? '',
      })),
      createdAt: attempt.createdAt,
    };
  }

  /** Intentos y mejor nota de un usuario en cada quiz, en una sola consulta. */
  async myStats(
    teamId: string,
    userId: string,
    quizIds: string[],
  ): Promise<Map<string, MyQuizStats>> {
    const rows = await this.attemptModel
      .aggregate<{ _id: string; attempts: number; best: { correct: number; total: number } }>([
        { $match: { teamId, userId, quizId: { $in: quizIds } } },
        { $sort: { correct: -1, createdAt: 1 } },
        {
          $group: {
            _id: '$quizId',
            attempts: { $sum: 1 },
            best: { $first: { correct: '$correct', total: '$total' } },
          },
        },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id, { attempts: row.attempts, best: row.best }]));
  }

  /**
   * Resultados para el coach: cada jugador con cuenta (aunque no lo haya respondido) y
   * cuántos aciertan cada pregunta en su último intento, para saber qué repasar.
   */
  async results(teamId: string, quizId: string): Promise<QuizResultsResponseDto> {
    const [quiz, players] = await Promise.all([
      this.findOne(teamId, quizId),
      this.teams.listPlayers(teamId),
    ]);
    const attempts = await this.attemptModel
      .find({ teamId, quizId, userId: { $in: players.map(({ member }) => member.userId) } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const latest = new Map<string, (typeof attempts)[number]>();
    for (const attempt of attempts) {
      if (!latest.has(attempt.userId)) latest.set(attempt.userId, attempt);
    }
    const rows = players.map(({ rosterPlayerId, member }) => {
      const mine = attempts.filter((attempt) => attempt.userId === member.userId);
      const best = mine.reduce<(typeof mine)[number] | null>(
        (top, attempt) => (!top || attempt.correct > top.correct ? attempt : top),
        null,
      );
      const last = latest.get(member.userId);
      return {
        rosterPlayerId,
        userId: member.userId,
        name: member.name,
        attempts: mine.length,
        best: best ? { correct: best.correct, total: best.total } : null,
        last: last ? { correct: last.correct, total: last.total, at: last.createdAt } : null,
      };
    });

    const questions = quiz.questions.map((question) => {
      const answers = [...latest.values()].flatMap((attempt) =>
        attempt.answers.filter((answer) => answer.questionId === question.id),
      );
      return {
        questionId: question.id,
        answered: answers.length,
        correct: answers.filter((answer) => answer.isCorrect).length,
      };
    });
    return { players: rows, questions };
  }
}
