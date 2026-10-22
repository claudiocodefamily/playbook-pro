import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { ApiError } from '../lib/api/client';
import { LoginPage } from './LoginPage';

function renderLogin(login: AuthContextValue['login']) {
  const value: AuthContextValue = {
    state: { status: 'anonymous' },
    login,
    register: vi.fn<AuthContextValue['register']>(),
    logout: vi.fn<AuthContextValue['logout']>(),
  };
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <p>Registro</p> },
    ],
    { initialEntries: ['/login'] },
  );
  render(
    <AuthContext value={value}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
}

describe('LoginPage', () => {
  it('inicia sesión con el email y la contraseña escritos', async () => {
    const login = vi.fn<AuthContextValue['login']>().mockResolvedValue(undefined);
    renderLogin(login);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'coach@equipo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'touchdown-2026');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(login).toHaveBeenCalledWith('coach@equipo.com', 'touchdown-2026');
  });

  it('enseña el mensaje de la API si las credenciales no valen', async () => {
    const login = vi
      .fn<AuthContextValue['login']>()
      .mockRejectedValue(new ApiError(401, 'Email o contraseña incorrectos'));
    renderLogin(login);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'coach@equipo.com');
    await user.type(screen.getByLabelText('Contraseña'), 'mala-clave');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
});
