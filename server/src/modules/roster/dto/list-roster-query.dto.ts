import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ListRosterQueryDto {
  @ApiPropertyOptional({
    description: 'true = solo jugadores activos, false = solo inactivos. Sin valor, todos.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'active debe ser true o false' })
  active?: boolean;
}
