import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageSpinner } from '../components/ui/spinner';
import { useAuth } from './auth-context';

/** Solo deja pasar con sesión iniciada; si no, manda al login y luego vuelve aquí. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <PageSpinner label="Recuperando tu sesión…" />;
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/** Login y registro: si ya hay sesión, vuelve a donde quería ir el coach. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (state.status === 'loading') return <PageSpinner label="Recuperando tu sesión…" />;
  if (state.status === 'authenticated') return <Navigate to={from} replace />;
  return children;
}
