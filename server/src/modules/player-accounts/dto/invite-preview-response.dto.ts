import { ApiProperty } from '@nestjs/swagger';

/** Lo que ve un jugador al abrir su invitación, antes de aceptarla. */
export class InvitePreviewResponseDto {
  @ApiProperty({ example: 'Lobos' })
  teamName!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  playerName!: string;

  @ApiProperty({ example: 12 })
  number!: number;

  @ApiProperty()
  expiresAt!: Date;
}

export class AcceptInviteResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Equipo al que acaba de entrar' })
  teamId!: string;
}
