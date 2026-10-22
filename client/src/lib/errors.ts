import { ApiError } from './api/client';

/** Texto de error para enseñar al coach, venga de la API o de la red. */
export function errorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'No hay conexión con el servidor. Revisa tu internet.';
  return 'Algo salió mal. Inténtalo de nuevo.';
}
