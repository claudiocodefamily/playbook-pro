import { SetMetadata } from '@nestjs/common';

export const ALLOW_PLAYERS_KEY = 'allowPlayers';

/**
 * Abre una ruta de equipo a los jugadores, además de a los coaches. Sin esta marca,
 * `TeamAccessGuard` solo deja pasar a coaches: lo nuevo nace cerrado a los jugadores.
 */
export const AllowPlayers = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PLAYERS_KEY, true);
