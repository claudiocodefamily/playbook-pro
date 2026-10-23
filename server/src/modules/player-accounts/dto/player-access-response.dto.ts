import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlayerAccountDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name!: string;

  @ApiProperty({ example: 'juan@correo.com' })
  email!: string;

  @ApiProperty()
  joinedAt!: Date;
}

/** Acceso de un jugador del roster: su cuenta, si la tiene, y si hay una invitación pendiente. */
export class PlayerAccessResponseDto {
  @ApiProperty({ format: 'uuid' })
  rosterPlayerId!: string;

  @ApiPropertyOptional({ type: PlayerAccountDto, nullable: true })
  account!: PlayerAccountDto | null;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description: 'Caducidad de la invitación pendiente, si hay una',
  })
  inviteExpiresAt!: Date | null;
}

/** Una invitación recién creada. El token solo se devuelve aquí. */
export class PlayerInviteResponseDto {
  @ApiProperty({ format: 'uuid' })
  rosterPlayerId!: string;

  @ApiProperty({ description: 'Secreto del link /join/:token. No se vuelve a mostrar.' })
  token!: string;

  @ApiProperty()
  expiresAt!: Date;
}
