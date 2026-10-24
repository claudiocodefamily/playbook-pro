import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AllowPlayers } from '../../common/decorators/allow-players.decorator.js';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  isPlayer,
  Membership,
  type TeamMembership,
} from '../../common/decorators/team-member.decorator.js';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { AddTextQuestionDto } from './dto/add-text-question.dto.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { QuizCoverageQueryDto, QuizCoverageResponseDto } from './dto/quiz-coverage.dto.js';
import {
  AttemptResultResponseDto,
  QuizResponseDto,
  QuizSummaryResponseDto,
} from './dto/quiz-response.dto.js';
import { QuizResultsResponseDto } from './dto/quiz-results-response.dto.js';
import { SubmitAttemptDto } from './dto/submit-attempt.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { QuizzesService } from './quizzes.service.js';
import type { QuizDocument } from './schemas/quiz.schema.js';

@ApiTags('quizzes')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({ description: 'El equipo o el quiz no existen, o no eres del equipo' })
@ApiForbiddenResponse({ description: 'Solo los coaches del equipo pueden hacer esto' })
@Controller('teams/:teamId/quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea un quiz con preguntas sacadas de las jugadas de un playbook',
    description:
      'Por cada jugador de las posiciones elegidas con una tarea dibujada: "¿qué hace en esta jugada?", con su tarea y otras parecidas como opciones. Nace oculto a los jugadores.',
  })
  @ApiCreatedResponse({ type: QuizResponseDto })
  @ApiBadRequestResponse({ description: 'Ninguna jugada tiene tareas para esas posiciones' })
  async create(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: CreateQuizDto,
    @CurrentUser() user: AuthUser,
  ): Promise<QuizResponseDto> {
    const quiz = await this.quizzes.create(teamId, user.id, dto);
    return QuizResponseDto.fromQuiz(quiz, { withAnswers: true });
  }

  @Get()
  @AllowPlayers()
  @ApiOperation({
    summary: 'Lista los quizzes del equipo, con tu número de intentos y tu mejor nota',
    description: 'Un jugador solo recibe los publicados.',
  })
  @ApiOkResponse({ type: [QuizSummaryResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @CurrentUser() user: AuthUser,
    @Membership() membership: TeamMembership,
  ): Promise<QuizSummaryResponseDto[]> {
    const quizzes = await this.quizzes.findAll(teamId, { playersOnly: isPlayer(membership) });
    const stats = await this.quizzes.myStats(
      teamId,
      user.id,
      quizzes.map((quiz) => quiz._id),
    );
    return quizzes.map((quiz) => QuizSummaryResponseDto.from(quiz, stats.get(quiz._id)));
  }

  // Antes de `:quizId`, para que "coverage" no se tome por el id de un quiz.
  @Get('coverage')
  @ApiOperation({
    summary: 'Cuántas preguntas saldrían de cada posición con las jugadas de un playbook',
    description: 'Para elegir posiciones con tareas dibujadas antes de crear el quiz.',
  })
  @ApiOkResponse({ type: QuizCoverageResponseDto })
  coverage(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Query() query: QuizCoverageQueryDto,
  ): Promise<QuizCoverageResponseDto> {
    return this.quizzes.coverage(teamId, query.playbookId);
  }

  @Get(':quizId')
  @AllowPlayers()
  @ApiOperation({
    summary: 'Devuelve un quiz con sus preguntas',
    description: 'Los jugadores no reciben la respuesta correcta: la ven al enviar sus respuestas.',
  })
  @ApiOkResponse({ type: QuizResponseDto })
  async findOne(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('quizId', ParseUuidPipe) quizId: string,
    @CurrentUser() user: AuthUser,
    @Membership() membership: TeamMembership,
  ): Promise<QuizResponseDto> {
    const player = isPlayer(membership);
    const quiz = await this.quizzes.findOne(teamId, quizId, { playersOnly: player });
    const stats = await this.quizzes.myStats(teamId, user.id, [quiz._id]);
    return QuizResponseDto.fromQuiz(quiz, { withAnswers: !player, mine: stats.get(quiz._id) });
  }

  @Patch(':quizId')
  @ApiOperation({ summary: 'Cambia el título o publica/oculta el quiz a los jugadores' })
  @ApiOkResponse({ type: QuizResponseDto })
  async update(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('quizId', ParseUuidPipe) quizId: string,
    @Body() dto: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    return this.full(await this.quizzes.update(teamId, quizId, dto));
  }

  @Delete(':quizId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra el quiz y los intentos de los jugadores' })
  @ApiNoContentResponse()
  remove(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('quizId', ParseUuidPipe) quizId: string,
  ): Promise<void> {
    return this.quizzes.remove(teamId, quizId);
  }

  @Post(':quizId/questions')
  @ApiOperation({ summary: 'Añade una pregunta escrita por el coach, con respuestas de texto' })
  @ApiCreatedResponse({ type: QuizResponseDto })
  @ApiBadRequestResponse({ description: 'Respuesta correcta inválida o quiz lleno' })
  async addQuestion(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('quizId', ParseUuidPipe) quizId: string,
    @Body() dto: AddTextQuestionDto,
  ): Promise<QuizResponseDto> {
    return this.full(await this.quizzes.addTextQuestion(teamId, quizId, dto));
  }

  @Delete(':quizId/questions/:questionId')
  @ApiOperation({ summary: 'Quita una pregunta del quiz' })
  @ApiOkResponse({ type: QuizResponseDto })
  async removeQuestion(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('quizId', ParseUuidPipe) quizId: string,
    @Param('questionId', ParseUuidPipe) questionId: string,
  ): Promise<QuizResponseDto> {
    return this.full(await this.quizzes.removeQuestion(teamId, quizId, questionId));
  }

  @Get(':quizId/results')
  @ApiOperation({
    summary: 'Resultados del quiz: la nota de cada jugador con cuenta y los aciertos por pregunta',
    description: 'Los aciertos por pregunta cuentan el último intento de cada jugador.',
  })
  @ApiOkResponse({ type: QuizResultsResponseDto })
  results(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('quizId', ParseUuidPipe) quizId: string,
  ): Promise<QuizResultsResponseDto> {
    return this.quizzes.results(teamId, quizId);
  }

  @Post(':quizId/attempts')
  @AllowPlayers()
  @ApiOperation({
    summary: 'Envía las respuestas: devuelve la nota y la respuesta correcta de cada pregunta',
    description: 'Se puede repetir; cada intento queda guardado.',
  })
  @ApiCreatedResponse({ type: AttemptResultResponseDto })
  submit(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('quizId', ParseUuidPipe) quizId: string,
    @Body() dto: SubmitAttemptDto,
    @CurrentUser() user: AuthUser,
    @Membership() membership: TeamMembership,
  ): Promise<AttemptResultResponseDto> {
    return this.quizzes.submit(teamId, quizId, user.id, dto, {
      playersOnly: isPlayer(membership),
    });
  }

  /** Lo que devuelven las rutas de coach: el quiz con las respuestas. */
  private full(quiz: QuizDocument): QuizResponseDto {
    return QuizResponseDto.fromQuiz(quiz, { withAnswers: true });
  }
}
