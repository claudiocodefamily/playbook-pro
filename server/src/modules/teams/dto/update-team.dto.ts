import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';
import { CreateTeamDto } from './create-team.dto.js';

export class UpdateTeamDto extends PartialType(OmitType(CreateTeamDto, ['logoUrl'] as const)) {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'URL https del logo. Envía null para quitarlo.',
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'El logo debe ser una URL https' },
  )
  @MaxLength(500)
  logoUrl?: string | null;
}
