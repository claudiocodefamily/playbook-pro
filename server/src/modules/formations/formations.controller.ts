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
import { CreateFormationDto } from './dto/create-formation.dto.js';
import { FormationResponseDto } from './dto/formation-response.dto.js';
import { ListFormationsQueryDto } from './dto/list-formations-query.dto.js';
import { UpdateFormationDto } from './dto/update-formation.dto.js';
import { FormationsService } from './formations.service.js';

@ApiTags('formations')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({
  description: 'El equipo o la formación no existen, o no eres coach del equipo',
})
@Controller('teams/:teamId/formations')
export class FormationsController {
  constructor(private readonly formations: FormationsService) {}

  @Post()
  @ApiOperation({ summary: 'Crea una formación propia del equipo' })
  @ApiCreatedResponse({ type: FormationResponseDto })
  @ApiConflictResponse({ description: 'Ya hay una formación con ese nombre en esa unidad' })
  async create(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: CreateFormationDto,
  ): Promise<FormationResponseDto> {
    return FormationResponseDto.from(await this.formations.create(teamId, dto));
  }

  @Get()
  @ApiOperation({ summary: 'Lista las formaciones del equipo y después las globales' })
  @ApiOkResponse({ type: [FormationResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Query() query: ListFormationsQueryDto,
  ): Promise<FormationResponseDto[]> {
    const formations = await this.formations.findAll(teamId, query.side);
    return formations.map((formation) => FormationResponseDto.from(formation));
  }

  @Get(':formationId')
  @ApiOperation({ summary: 'Devuelve una formación del equipo o una global' })
  @ApiOkResponse({ type: FormationResponseDto })
  async findOne(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('formationId', ParseUuidPipe) formationId: string,
  ): Promise<FormationResponseDto> {
    return FormationResponseDto.from(await this.formations.findOne(teamId, formationId));
  }

  @Patch(':formationId')
  @ApiOperation({ summary: 'Edita una formación del equipo (las globales no se editan)' })
  @ApiOkResponse({ type: FormationResponseDto })
  @ApiConflictResponse({ description: 'Es una formación global, o el nombre ya existe' })
  async update(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('formationId', ParseUuidPipe) formationId: string,
    @Body() dto: UpdateFormationDto,
  ): Promise<FormationResponseDto> {
    return FormationResponseDto.from(await this.formations.update(teamId, formationId, dto));
  }

  @Delete(':formationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra una formación del equipo (las globales no se borran)' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Es una formación global' })
  remove(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('formationId', ParseUuidPipe) formationId: string,
  ): Promise<void> {
    return this.formations.remove(teamId, formationId);
  }
}
