import { useQuery } from '@tanstack/react-query';
import { LinkIcon, LogIn, UserPlus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/auth-context';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { PageSpinner } from '../../components/ui/spinner';
import { AuthLayout } from '../../layouts/AuthLayout';
import { queries, useAcceptInvite } from '../../lib/api/queries';
import { errorText } from '../../lib/errors';

/**
 * Invitación de un jugador: enseña a qué equipo entra y como quién. Sin sesión, manda a
 * crear la cuenta o a entrar y luego vuelve aquí para aceptarla.
 */
export function JoinPage() {
  const { token = '' } = useParams();
  const { state } = useAuth();
  const invite = useQuery(queries.invite(token));
  const accept = useAcceptInvite();
  const navigate = useNavigate();
  const back = { from: `/join/${token}` };

  if (invite.isPending || state.status === 'loading') {
    return <PageSpinner label="Abriendo la invitación…" />;
  }
  if (invite.isError) {
    return (
      <AuthLayout title="Invitación no válida" subtitle="Pide al coach que te mande otra.">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-turf-100 text-turf-700 dark:bg-turf-900/60 dark:text-turf-100">
            <LinkIcon aria-hidden className="size-6" />
          </span>
          <p className="text-slate-600">{errorText(invite.error)}</p>
          <Link to="/" className="font-semibold text-turf-700 hover:underline dark:text-turf-300">
            Ir a PlayBook Pro
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const { teamName, playerName, number } = invite.data;
  return (
    <AuthLayout
      title={`Únete a ${teamName}`}
      subtitle={`El coach te invita como #${number} ${playerName}. Verás las jugadas con tu posición resaltada.`}
    >
      {state.status === 'authenticated' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Entrarás con tu cuenta <span className="font-semibold">{state.user.email}</span>.
          </p>
          <ErrorAlert message={errorText(accept.error)} />
          <Button
            size="lg"
            loading={accept.isPending}
            onClick={() =>
              accept.mutate(token, {
                onSuccess: ({ teamId }) => void navigate(`/teams/${teamId}`, { replace: true }),
              })
            }
          >
            Unirme al equipo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => void navigate('/register', { state: back })}>
            <UserPlus aria-hidden className="size-5" />
            Crear mi cuenta
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => void navigate('/login', { state: back })}
          >
            <LogIn aria-hidden className="size-5" />
            Ya tengo cuenta
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
