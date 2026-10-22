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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { CreatePlaybookDto } from './dto/create-playbook.dto.js';
import { ListPlaybooksQueryDto } from './dto/list-playbooks-query.dto.js';
import { PlaybookResponseDto } from './dto/playbook-response.dto.js';
import { UpdatePlaybookDto } from './dto/update-playbook.dto.js';
import { PlaybooksService } from './playbooks.service.js';
import type { PlaybookDocument } from './schemas/playbook.schema.js';

@ApiTags('playbooks')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({
  description: 'El equipo o el playbook no existen, o no eres coach del equipo',
})
@Controller('teams/:teamId/playbooks')
export class PlaybooksController {
  constructor(private readonly playbooks: PlaybooksService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un playbook (ofensivo, defensivo o de special teams)' })
  @ApiCreatedResponse({ type: PlaybookResponseDto })
  async create(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Body() dto: CreatePlaybookDto,
  ): Promise<PlaybookResponseDto> {
    return PlaybookResponseDto.from(await this.playbooks.create(teamId, dto), 0);
  }

  @Get()
  @ApiOperation({ summary: 'Lista los playbooks del equipo, con su número de jugadas' })
  @ApiOkResponse({ type: [PlaybookResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Query() query: ListPlaybooksQueryDto,
  ): Promise<PlaybookResponseDto[]> {
    const playbooks = await this.playbooks.findAll(teamId, query.side);
    const counts = await this.playbooks.countPlays(
      teamId,
      playbooks.map((playbook) => playbook._id),
    );
    return playbooks.map((playbook) =>
      PlaybookResponseDto.from(playbook, counts.get(playbook._id) ?? 0),
    );
  }

  @Get(':playbookId')
  @ApiOperation({ summary: 'Devuelve un playbook' })
  @ApiOkResponse({ type: PlaybookResponseDto })
  async findOne(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
  ): Promise<PlaybookResponseDto> {
    return this.withCount(teamId, await this.playbooks.findOne(teamId, playbookId));
  }

  @Patch(':playbookId')
  @ApiOperation({ summary: 'Edita el nombre, la unidad o la descripción de un playbook' })
  @ApiOkResponse({ type: PlaybookResponseDto })
  async update(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
    @Body() dto: UpdatePlaybookDto,
  ): Promise<PlaybookResponseDto> {
    return this.withCount(teamId, await this.playbooks.update(teamId, playbookId, dto));
  }

  @Delete(':playbookId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra un playbook y sus jugadas (borrado lógico)' })
  @ApiNoContentResponse()
  remove(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
  ): Promise<void> {
    return this.playbooks.remove(teamId, playbookId);
  }

  private async withCount(
    teamId: string,
    playbook: PlaybookDocument,
  ): Promise<PlaybookResponseDto> {
    const counts = await this.playbooks.countPlays(teamId, [playbook._id]);
    return PlaybookResponseDto.from(playbook, counts.get(playbook._id) ?? 0);
  }
}
