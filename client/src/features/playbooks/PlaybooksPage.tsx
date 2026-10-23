import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { SelectField, TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { queries, useCreatePlaybook, useDeletePlaybook } from '../../lib/api/queries';
import type { Playbook } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { SIDE_LABELS } from '../../lib/labels';
import { SIDE_STYLE } from './side-style';

type Filter = PlaybookSide | 'all';

export function PlaybooksPage() {
  const { teamId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const playbooks = useQuery(queries.playbooks(teamId));
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Playbook | null>(null);
  const deletePlaybook = useDeletePlaybook(teamId);

  const visible = (playbooks.data ?? []).filter(
    (playbook) => filter === 'all' || playbook.side === filter,
  );
  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden className="size-4" />
      Nuevo playbook
    </Button>
  );

  return (
    <>
      <PageHeader
        title={team.data?.name ?? 'Equipo'}
        subtitle="Playbooks del equipo"
        back={{ to: '/', label: 'Mis equipos' }}
        actions={createButton}
      />

      <div role="tablist" aria-label="Unidad" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(['all', ...PLAYBOOK_SIDES] as const).map((side) => (
          <button
            key={side}
            role="tab"
            aria-selected={filter === side}
            onClick={() => setFilter(side)}
            className={cn(
              'relative min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors',
              filter === side
                ? 'text-white'
                : 'bg-surface text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
            )}
          >
            {filter === side && (
              <motion.span
                layoutId="side-tab"
                className="absolute inset-0 rounded-full bg-turf-700"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">{side === 'all' ? 'Todos' : SIDE_LABELS[side]}</span>
          </button>
        ))}
      </div>

      {playbooks.isPending ? (
        <PageSpinner />
      ) : playbooks.isError ? (
        <ErrorAlert message={errorText(playbooks.error)} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            filter === 'all'
              ? 'Aún no hay playbooks'
              : `No hay playbooks de ${SIDE_LABELS[filter].toLowerCase()}`
          }
          description="Un playbook agrupa las jugadas de una unidad: por ejemplo, la ofensiva de la temporada o la defensa de red zone."
          action={createButton}
        />
      ) : (
        <motion.ul layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((playbook) => (
              <motion.li
                key={playbook.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="relative"
              >
                <Link
                  to={`/teams/${teamId}/playbooks/${playbook.id}`}
                  className="flex h-full flex-col gap-3 rounded-3xl bg-surface p-5 pr-16 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                >
                  <span
                    className={cn(
                      'self-start rounded-full px-3 py-1 text-xs font-bold',
                      SIDE_STYLE[playbook.side],
                    )}
                  >
                    {SIDE_LABELS[playbook.side]}
                  </span>
                  <span className="text-xl font-semibold">{playbook.name}</span>
                  {playbook.description && (
                    <span className="line-clamp-2 text-sm text-slate-600">
                      {playbook.description}
                    </span>
                  )}
                  <span className="mt-auto text-sm font-medium text-slate-500">
                    {playbook.playCount} {playbook.playCount === 1 ? 'jugada' : 'jugadas'}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 text-slate-400 hover:text-red-600"
                  aria-label={`Borrar ${playbook.name}`}
                  onClick={() => setDeleting(playbook)}
                >
                  <Trash2 aria-hidden className="size-5" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <CreatePlaybookModal
        teamId={teamId}
        open={creating}
        defaultSide={filter === 'all' ? 'offense' : filter}
        onClose={() => setCreating(false)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="¿Borrar el playbook?"
        message={`Se ocultarán «${deleting?.name ?? ''}» y todas sus jugadas.`}
        confirmLabel="Borrar"
        pending={deletePlaybook.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting && deletePlaybook.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  );
}

function CreatePlaybookModal({
  teamId,
  open,
  defaultSide,
  onClose,
}: {
  teamId: string;
  open: boolean;
  defaultSide: PlaybookSide;
  onClose: () => void;
}) {
  const createPlaybook = useCreatePlaybook(teamId);
  const navigate = useNavigate();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get('description')).trim();
    createPlaybook.mutate(
      {
        name: String(form.get('name')).trim(),
        side: String(form.get('side')) as PlaybookSide,
        ...(description ? { description } : {}),
      },
      { onSuccess: (playbook) => void navigate(`/teams/${teamId}/playbooks/${playbook.id}`) },
    );
  };

  return (
    <Modal open={open} title="Nuevo playbook" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Nombre"
          name="name"
          required
          maxLength={100}
          autoFocus
          placeholder="Ofensiva 2026"
        />
        <SelectField label="Unidad" name="side" defaultValue={defaultSide}>
          {PLAYBOOK_SIDES.map((side) => (
            <option key={side} value={side}>
              {SIDE_LABELS[side]}
            </option>
          ))}
        </SelectField>
        <TextField label="Descripción (opcional)" name="description" maxLength={2000} />
        <ErrorAlert message={errorText(createPlaybook.error)} />
        <Button type="submit" size="lg" loading={createPlaybook.isPending}>
          Crear playbook
        </Button>
      </form>
    </Modal>
  );
}
