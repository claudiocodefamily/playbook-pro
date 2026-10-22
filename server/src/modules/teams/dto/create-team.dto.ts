import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RULESETS, type Ruleset } from '@playbook/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Lobos de Monterrey', maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre del equipo es obligatorio' })
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    enum: RULESETS,
    default: 'college',
    description: 'Reglamento del equipo: define la separación de los hash marks',
  })
  @IsOptional()
  @IsIn(RULESETS, { message: `El reglamento debe ser uno de: ${RULESETS.join(', ')}` })
  ruleset?: Ruleset;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/demo/image/upload/logo.png' })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'El logo debe ser una URL https' },
  )
  @MaxLength(500)
  logoUrl?: string;
}
