import { ApiPropertyOptional } from '@nestjs/swagger';
import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import { IsIn, IsOptional } from 'class-validator';

export class ListPlaybooksQueryDto {
  @ApiPropertyOptional({ enum: PLAYBOOK_SIDES, description: 'Sin valor, todas las unidades' })
  @IsOptional()
  @IsIn(PLAYBOOK_SIDES, { message: `side debe ser uno de: ${PLAYBOOK_SIDES.join(', ')}` })
  side?: PlaybookSide;
}
