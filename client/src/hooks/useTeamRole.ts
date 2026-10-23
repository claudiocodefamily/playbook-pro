import { useQuery } from '@tanstack/react-query';
import { queries } from '../lib/api/queries';

/**
 * Mi rol en el equipo. `isCoach` es false mientras carga, así los botones de editar no
 * aparecen un instante a un jugador.
 */
export function useTeamRole(teamId: string) {
  const team = useQuery(queries.team(teamId));
  const role = team.data?.myRole ?? null;
  return { role, isCoach: role === 'COACH', isPlayer: role === 'PLAYER' };
}
