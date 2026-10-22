import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api/client';
import { authApi } from '../lib/api/endpoints';
import type { AuthResponse } from '../lib/api/types';
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context';

/**
 * Guarda quién ha iniciado sesión. Al abrir la web intenta recuperar la sesión con la
 * cookie del refresh token, así el coach no tiene que volver a escribir su contraseña.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = (await api.refreshSession()) ? await authApi.me().catch(() => null) : null;
      if (!cancelled) {
        setState(restored ? { status: 'authenticated', user: restored } : { status: 'anonymous' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Si la sesión caduca del todo (falla la renovación), se vuelve a la pantalla de login.
  useEffect(
    () =>
      api.onTokenChange((token) => {
        if (token === null) {
          setState((current) =>
            current.status === 'authenticated' ? { status: 'anonymous' } : current,
          );
        }
      }),
    [],
  );

  const startSession = useCallback((response: AuthResponse) => {
    api.setAccessToken(response.accessToken);
    setState({ status: 'authenticated', user: response.user });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (email, password) => startSession(await authApi.login(email, password)),
      register: async (name, email, password) =>
        startSession(await authApi.register(name, email, password)),
      logout: async () => {
        await authApi.logout().catch(() => undefined);
        api.setAccessToken(null);
        // Que el siguiente coach que use este dispositivo no vea datos del anterior.
        queryClient.clear();
        setState({ status: 'anonymous' });
      },
    }),
    [state, startSession, queryClient],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
