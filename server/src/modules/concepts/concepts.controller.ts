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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { PlaySummaryResponseDto } from '../plays/dto/play-response.dto.js';
import { ConceptsService } from './concepts.service.js';
import { ConceptResponseDto } from './dto/concept-response.dto.js';
import { CreateConceptDto } from './dto/create-concept.dto.js';
import { ListConceptsQueryDto } from './dto/list-concepts-query.dto.js';
import { UpdateConceptDto } from './dto/update-concept.dto.js';

@ApiTags('concepts')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({
  description: 'El equipo o el concepto no existen, o no eres coach del equipo',
})
@Controller('teams/:teamId/concepts')
export class ConceptsController {
  constructor(private readonly concepts: ConceptsService) {}

  @Post()
  @ApiOperation({ summary: 'Añade un concepto al glosario del equipo' })
  @ApiCreatedResponse({ type: ConceptResponseDto })
  @ApiConflictResponse({ description: 'Ya hay un concepto con ese nombre' })
  async create(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: CreateConceptDto,
  ): Promise<ConceptResponseDto> {
    return ConceptResponseDto.from(await this.concepts.create(teamId, dto));
  }

  @Get()
  @ApiOperation({
    summary: 'Glosario: conceptos del equipo y globales, con cuántas jugadas usan cada uno',
  })
  @ApiOkResponse({ type: [ConceptResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Query() query: ListConceptsQueryDto,
  ): Promise<ConceptResponseDto[]> {
    const [concepts, counts] = await Promise.all([
      this.concepts.findAll(teamId, query.side),
      this.concepts.playCounts(teamId),
    ]);
    return concepts.map((concept) => ConceptResponseDto.from(concept, counts.get(concept._id)));
  }

  @Get(':conceptId')
  @ApiOperation({ summary: 'Devuelve un concepto del equipo o uno global' })
  @ApiOkResponse({ type: ConceptResponseDto })
  async findOne(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('conceptId', ParseUuidPipe) conceptId: string,
  ): Promise<ConceptResponseDto> {
    const [concept, counts] = await Promise.all([
      this.concepts.findOne(teamId, conceptId),
      this.concepts.playCounts(teamId),
    ]);
    return ConceptResponseDto.from(concept, counts.get(concept._id));
  }

  @Get(':conceptId/plays')
  @ApiOperation({ summary: 'Jugadas del equipo que enseñan el concepto' })
  @ApiOkResponse({ type: [PlaySummaryResponseDto] })
  async plays(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('conceptId', ParseUuidPipe) conceptId: string,
  ): Promise<PlaySummaryResponseDto[]> {
    const plays = await this.concepts.plays(teamId, conceptId);
    return plays.map((play) => PlaySummaryResponseDto.from(play));
  }

  @Patch(':conceptId')
  @ApiOperation({ summary: 'Edita un concepto del equipo (los globales no se editan)' })
  @ApiOkResponse({ type: ConceptResponseDto })
  @ApiConflictResponse({ description: 'Es un concepto global, o el nombre ya existe' })
  async update(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('conceptId', ParseUuidPipe) conceptId: string,
    @Body() dto: UpdateConceptDto,
  ): Promise<ConceptResponseDto> {
    const [concept, counts] = await Promise.all([
      this.concepts.update(teamId, conceptId, dto),
      this.concepts.playCounts(teamId),
    ]);
    return ConceptResponseDto.from(concept, counts.get(concept._id));
  }

  @Delete(':conceptId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borra un concepto del equipo y lo quita de sus jugadas (los globales no se borran)',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Es un concepto global' })
  remove(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('conceptId', ParseUuidPipe) conceptId: string,
  ): Promise<void> {
    return this.concepts.remove(teamId, conceptId);
  }
}
