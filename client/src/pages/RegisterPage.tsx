import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { ErrorAlert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/field';
import { AuthLayout } from '../layouts/AuthLayout';
import { errorText } from '../lib/errors';

const MIN_PASSWORD = 8;

export function RegisterPage() {
  const { register } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await register(
        String(form.get('name')).trim(),
        String(form.get('email')),
        String(form.get('password')),
      );
    } catch (caught) {
      setError(caught);
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Una cuenta de coach para diseñar y enseñar jugadas."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField label="Nombre" name="name" autoComplete="name" required maxLength={80} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          hint={`Al menos ${MIN_PASSWORD} caracteres.`}
        />
        <ErrorAlert message={errorText(error)} />
        <Button type="submit" size="lg" loading={pending}>
          Crear cuenta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-turf-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
