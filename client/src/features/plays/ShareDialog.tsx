import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Link2, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { SelectField, TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { Spinner } from '../../components/ui/spinner';
import { queries, useCreateShareLink, useRevokeShareLink } from '../../lib/api/queries';
import type { ShareLink } from '../../lib/api/types';
import { errorText } from '../../lib/errors';

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: '7', label: '1 semana' },
  { value: '30', label: '1 mes' },
  { value: '180', label: 'Toda la temporada (6 meses)' },
  { value: 'never', label: 'Nunca (hasta que lo desactives)' },
];

export function sharedUrl(token: string): string {
  return `${window.location.origin}/shared/${token}`;
}

const dateFormat = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

interface ShareDialogProps {
  open: boolean;
  teamId: string;
  playbookId: string;
  onClose: () => void;
}

/**
 * Crea links de solo lectura al playbook. La dirección completa solo se ve al crearla: el
 * servidor guarda únicamente su huella, así que nadie (ni nosotros) puede volver a leerla.
 */
export function ShareDialog({ open, teamId, playbookId, onClose }: ShareDialogProps) {
  const links = useQuery({ ...queries.shareLinks(teamId, playbookId), enabled: open });
  const create = useCreateShareLink(teamId, playbookId);
  const revoke = useRevokeShareLink(teamId, playbookId);
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState('180');
  const [created, setCreated] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setCreated(null);
    setCopied(false);
    create.reset();
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    create.mutate(
      {
        ...(trimmed ? { label: trimmed } : {}),
        expiresInDays: expiry === 'never' ? null : Number(expiry),
      },
      {
        onSuccess: (link) => {
          setCreated(link);
          setCopied(false);
          setLabel('');
        },
      },
    );
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso para el portapapeles: el link sigue a la vista para copiarlo a mano.
      setCopied(false);
    }
  };

  return (
    <Modal open={open} title="Compartir playbook" onClose={close}>
      <p className="mb-4 text-sm text-slate-600">
        Quien tenga el link ve las jugadas animadas pero no puede cambiar nada. No necesita cuenta.
        Puedes desactivarlo cuando quieras.
      </p>

      {created?.token ? (
        <div className="mb-6 flex flex-col gap-2 rounded-2xl bg-turf-50 p-4 ring-1 ring-turf-600/30 dark:bg-turf-900/40">
          <p className="text-sm font-semibold">
            Link listo. Cópialo ahora: no se vuelve a mostrar.
          </p>
          <input
            readOnly
            aria-label="Link para compartir"
            value={sharedUrl(created.token)}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-surface px-3 font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={() => void copy(sharedUrl(created.token ?? ''))}>
              {copied ? (
                <Check aria-hidden className="size-4" />
              ) : (
                <Copy aria-hidden className="size-4" />
              )}
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
            <Button variant="secondary" onClick={() => setCreated(null)}>
              Crear otro
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mb-6 flex flex-col gap-3">
          <TextField
            label="Para quién (opcional)"
            placeholder="Receptores, padres, staff…"
            maxLength={60}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <SelectField
            label="Caduca"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <ErrorAlert message={errorText(create.error)} />
          <Button type="submit" loading={create.isPending} className="self-start">
            <Link2 aria-hidden className="size-4" />
            Crear link
          </Button>
        </form>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-700">Links activos</h3>
      <ErrorAlert message={errorText(revoke.error ?? links.error)} />
      {links.isPending ? (
        <Spinner />
      ) : (links.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay links activos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(links.data ?? []).map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-2 ring-1 ring-slate-200 dark:bg-slate-800/40"
            >
              <span className="flex flex-col">
                <span className="font-medium">{link.label || 'Sin nombre'}</span>
                <span className="text-xs text-slate-500">
                  Creado {dateFormat.format(new Date(link.createdAt))} ·{' '}
                  {link.expiresAt
                    ? `caduca ${dateFormat.format(new Date(link.expiresAt))}`
                    : 'no caduca'}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Desactivar link ${link.label || 'sin nombre'}`}
                loading={revoke.isPending && revoke.variables === link.id}
                onClick={() => {
                  revoke.mutate(link.id);
                  if (created?.id === link.id) setCreated(null);
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
