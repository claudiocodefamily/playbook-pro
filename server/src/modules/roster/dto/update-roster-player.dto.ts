import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';
import { CreateRosterPlayerDto } from './create-roster-player.dto.js';

export class UpdateRosterPlayerDto extends PartialType(
  OmitType(CreateRosterPlayerDto, ['photoUrl'] as const),
) {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'URL https de la foto. Envía null para quitarla.',
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'La foto debe ser una URL https' },
  )
  @MaxLength(500)
  photoUrl?: string | null;
}
