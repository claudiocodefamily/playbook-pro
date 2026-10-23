import { useQuery } from '@tanstack/react-query';
import { Check, Copy, KeyRound, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { queries, useInvitePlayer, useRemovePlayerAccess } from '../../lib/api/queries';
import type { PlayerInvite, RosterPlayer } from '../../lib/api/types';
import { errorText } from '../../lib/errors';

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export function joinUrl(token: string): string {
  return `${window.location.origin}/join/${token}`;
}

/**
 * Cuenta del jugador: invitarle a entrar con su propia cuenta (solo mira los playbooks
 * visibles), ver si ya entró y quitarle el acceso.
 */
export function PlayerAccessSection({ teamId, player }: { teamId: string; player: RosterPlayer }) {
  const access = useQuery(queries.playerAccess(teamId));
  const invite = useInvitePlayer(teamId);
  const remove = useRemovePlayerAccess(teamId);
  const [created, setCreated] = useState<PlayerInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const mine = access.data?.find((entry) => entry.rosterPlayerId === player.id);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso para el portapapeles: el link sigue a la vista para copiarlo a mano.
      setCopied(false);
    }
  };
  const sendInvite = () =>
    invite.mutate(player.id, {
      onSuccess: (result) => {
        setCreated(result);
        setCopied(false);
      },
    });

  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <KeyRound aria-hidden className="size-4" />
        Cuenta del jugador
      </h3>
      <ErrorAlert message={errorText(invite.error ?? remove.error ?? access.error)} />

      {mine?.account ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-turf-50 p-3 ring-1 ring-turf-600/30 dark:bg-turf-900/40">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <UserCheck aria-hidden className="size-4 shrink-0 text-turf-700 dark:text-turf-300" />
            <span className="min-w-0">
              <span className="block font-semibold">Ya tiene cuenta</span>
              <span className="block truncate text-slate-500">{mine.account.email}</span>
            </span>
          </span>
          <Button
            variant="secondary"
            loading={remove.isPending}
            onClick={() => remove.mutate(player.id)}
          >
            <UserX aria-hidden className="size-4" />
            Quitar acceso
          </Button>
        </div>
      ) : created ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-turf-50 p-3 ring-1 ring-turf-600/30 dark:bg-turf-900/40">
          <p className="text-sm font-semibold">
            Mándale este link. Sirve una sola vez y caduca el{' '}
            {dateFormat.format(new Date(created.expiresAt))}.
          </p>
          <input
            readOnly
            aria-label="Link de invitación"
            value={joinUrl(created.token)}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-surface px-3 font-mono text-xs"
          />
          <Button className="self-start" onClick={() => void copy(joinUrl(created.token))}>
            {copied ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            {copied ? 'Copiado' : 'Copiar link'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            {mine?.inviteExpiresAt
              ? `Tiene una invitación pendiente hasta el ${dateFormat.format(new Date(mine.inviteExpiresAt))}. Si la perdió, crea otra: la anterior deja de valer.`
              : 'Con su propia cuenta ve las jugadas de los playbooks que hagas visibles, con su posición resaltada. No puede cambiar nada.'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" loading={invite.isPending} onClick={sendInvite}>
              <KeyRound aria-hidden className="size-4" />
              {mine?.inviteExpiresAt ? 'Crear otra invitación' : 'Invitar a crear su cuenta'}
            </Button>
            {mine?.inviteExpiresAt && (
              <Button
                variant="ghost"
                loading={remove.isPending}
                onClick={() => remove.mutate(player.id)}
              >
                Anular
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
