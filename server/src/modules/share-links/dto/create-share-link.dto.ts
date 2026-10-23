import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export const MAX_SHARE_DAYS = 365;

export class CreateShareLinkDto {
  @ApiPropertyOptional({ example: 'Receptores', maxLength: 60 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(60)
  label?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 30,
    minimum: 1,
    maximum: MAX_SHARE_DAYS,
    description: 'Días hasta que caduca. null o sin valor = no caduca (se puede revocar).',
  })
  @ValidateIf((_dto, value) => value !== undefined && value !== null)
  @IsInt({ message: 'expiresInDays debe ser un número entero de días' })
  @Min(1)
  @Max(MAX_SHARE_DAYS)
  expiresInDays?: number | null;
}
