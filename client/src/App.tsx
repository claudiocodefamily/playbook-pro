import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { ApiError } from './lib/api/client';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un 404 o un 400 no se arreglan reintentando; un fallo de red sí puede.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Respeta la opción "reducir movimiento" del sistema operativo. */}
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
  );
}
