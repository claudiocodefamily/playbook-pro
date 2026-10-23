import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ShareLinkDocument } from '../schemas/share-link.schema.js';

export class ShareLinkResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  playbookId!: string;

  @ApiProperty({ example: 'Receptores' })
  label!: string;

  @ApiProperty({ type: Date, nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({
    description:
      'Solo al crearlo: el token del link. No se puede volver a consultar (se guarda su hash).',
  })
  token?: string;

  static from(link: ShareLinkDocument, token?: string): ShareLinkResponseDto {
    const dto = new ShareLinkResponseDto();
    dto.id = link._id;
    dto.playbookId = link.playbookId;
    dto.label = link.label;
    dto.expiresAt = link.expiresAt;
    dto.createdAt = link.createdAt;
    if (token) dto.token = token;
    return dto;
  }
}
