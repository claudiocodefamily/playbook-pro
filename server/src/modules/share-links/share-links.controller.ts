import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { CreateShareLinkDto } from './dto/create-share-link.dto.js';
import { ShareLinkResponseDto } from './dto/share-link-response.dto.js';
import { SharedPlaybookResponseDto } from './dto/shared-playbook-response.dto.js';
import { ShareLinksService } from './share-links.service.js';

@ApiTags('share-links')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({
  description: 'El equipo, el playbook o el link no existen, o no eres coach del equipo',
})
@Controller('teams/:teamId/playbooks/:playbookId/share-links')
export class ShareLinksController {
  constructor(private readonly links: ShareLinksService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea un link de solo lectura al playbook (el token solo se ve en esta respuesta)',
  })
  @ApiCreatedResponse({ type: ShareLinkResponseDto })
  async create(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    const { link, token } = await this.links.create(teamId, playbookId, user.id, dto);
    return ShareLinkResponseDto.from(link, token);
  }

  @Get()
  @ApiOperation({ summary: 'Links activos del playbook (sin el token)' })
  @ApiOkResponse({ type: [ShareLinkResponseDto] })
  async findAll(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
  ): Promise<ShareLinkResponseDto[]> {
    const links = await this.links.findActive(teamId, playbookId);
    return links.map((link) => ShareLinkResponseDto.from(link));
  }

  @Delete(':linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva el link: deja de abrirse' })
  @ApiNoContentResponse()
  revoke(
    @Param('teamId', ParseUuidPipe) teamId: string,
    @Param('playbookId', ParseUuidPipe) playbookId: string,
    @Param('linkId', ParseUuidPipe) linkId: string,
  ): Promise<void> {
    return this.links.revoke(teamId, playbookId, linkId);
  }
}

@ApiTags('share-links')
@Controller('shared')
export class SharedPlaybookController {
  constructor(private readonly links: ShareLinksService) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Abre un link de solo lectura: el playbook y sus jugadas, sin login' })
  @ApiOkResponse({ type: SharedPlaybookResponseDto })
  @ApiNotFoundResponse({ description: 'El link no existe, caducó o se desactivó' })
  open(@Param('token') token: string): Promise<SharedPlaybookResponseDto> {
    return this.links.open(token);
  }
}
