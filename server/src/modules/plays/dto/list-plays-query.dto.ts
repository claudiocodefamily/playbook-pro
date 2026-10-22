import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListPlaysQueryDto {
  @ApiPropertyOptional({ example: 'red zone', description: 'Solo jugadas con esta etiqueta' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  tag?: string;

  @ApiPropertyOptional({ example: 'mesh', description: 'Busca en el nombre y las etiquetas' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q?: string;
}
