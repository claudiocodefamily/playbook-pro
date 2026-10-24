import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateQuizDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El título del quiz es obligatorio' })
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Si los jugadores con cuenta pueden responderlo' })
  @IsOptional()
  @IsBoolean()
  visibleToPlayers?: boolean;
}
