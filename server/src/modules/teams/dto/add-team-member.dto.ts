import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class AddTeamMemberDto {
  @ApiProperty({
    example: 'coordinador@equipo.com',
    description: 'Email de un coach que ya tiene cuenta en PlayBook Pro',
  })
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(254)
  email!: string;
}
