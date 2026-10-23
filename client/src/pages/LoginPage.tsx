import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { ErrorAlert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/field';
import { AuthLayout } from '../layouts/AuthLayout';
import { errorText } from '../lib/errors';

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(form.get('email')), String(form.get('password')));
    } catch (caught) {
      setError(caught);
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Inicia sesión" subtitle="Entra para ver los playbooks de tu equipo.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <ErrorAlert message={errorText(error)} />
        <Button type="submit" size="lg" loading={pending}>
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Aún no tienes cuenta?{' '}
        <Link
          to="/register"
          className="font-semibold text-turf-700 dark:text-turf-300 hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </AuthLayout>
  );
}
