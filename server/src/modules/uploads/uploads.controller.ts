import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { UploadSignatureResponseDto } from './dto/upload-signature-response.dto.js';
import { UploadsService } from './uploads.service.js';

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(TeamAccessGuard)
@ApiNotFoundResponse({ description: 'El equipo no existe o no eres coach del equipo' })
@Controller('teams/:teamId/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('roster-photo')
  @ApiOperation({
    summary: 'Firma la subida de una foto del roster',
    description:
      'El navegador sube la foto directamente a Cloudinary con esta firma; en Mongo solo se guarda la URL.',
  })
  @ApiCreatedResponse({ type: UploadSignatureResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Cloudinary no está configurado en la API' })
  signRosterPhoto(@Param('teamId', ParseUuidPipe) teamId: string): UploadSignatureResponseDto {
    return this.uploads.signRosterPhoto(teamId);
  }
}
