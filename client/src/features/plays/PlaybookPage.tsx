import { useQuery } from '@tanstack/react-query';
import { Copy, Plus, Search, Share2, Trash2, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { queries, useCreatePlay, useDeletePlay, useDuplicatePlay } from '../../lib/api/queries';
import type { Playbook, PlaySummary } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { SIDE_LABELS } from '../../lib/labels';
import { SIDE_STYLE } from '../playbooks/side-style';
import { FormationPicker } from './FormationPicker';
import { ShareDialog } from './ShareDialog';

export function PlaybookPage() {
  const { teamId = '', playbookId = '' } = useParams();
  const playbook = useQuery(queries.playbook(teamId, playbookId));
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const q = useDebouncedValue(search.trim());
  const plays = useQuery(
    queries.plays(teamId, playbookId, { ...(q ? { q } : {}), ...(tag ? { tag } : {}) }),
  );
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState<PlaySummary | null>(null);
  const duplicatePlay = useDuplicatePlay(teamId);
  const deletePlay = useDeletePlay(teamId);
  const filtered = Boolean(q || tag);

  // Las etiquetas de las jugadas visibles, para filtrar con un toque.
  const tags = [...new Set((plays.data ?? []).flatMap((play) => play.tags))].sort();

  const createButton = (
    <Button onClick={() => setCreating(true)} disabled={!playbook.data}>
      <Plus aria-hidden className="size-4" />
      Nueva jugada
    </Button>
  );

  return (
    <>
      <PageHeader
        title={playbook.data?.name ?? 'Playbook'}
        subtitle={
          playbook.data && (
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold',
                SIDE_STYLE[playbook.data.side],
              )}
            >
              {SIDE_LABELS[playbook.data.side]}
            </span>
          )
        }
        back={{ to: `/teams/${teamId}`, label: 'Playbooks' }}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSharing(true)} disabled={!playbook.data}>
              <Share2 aria-hidden className="size-4" />
              Compartir
            </Button>
            {createButton}
          </>
        }
      />
      <ShareDialog
        open={sharing}
        teamId={teamId}
        playbookId={playbookId}
        onClose={() => setSharing(false)}
      />

      <div className="mb-4 flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Buscar jugadas</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o etiqueta (mesh, red zone…)"
            className="min-h-12 w-full rounded-2xl border border-slate-300 bg-surface pr-3 pl-11 text-base shadow-sm focus:border-turf-600 focus:ring-2 focus:ring-turf-600/30 focus:outline-none"
          />
        </label>
        {(tags.length > 0 || tag) && (
          <div className="flex flex-wrap gap-2">
            {(tag && !tags.includes(tag) ? [tag, ...tags] : tags).map((value) => (
              <button
                key={value}
                onClick={() => setTag(tag === value ? null : value)}
                aria-pressed={tag === value}
                className={cn(
                  'min-h-9 rounded-full px-3 text-sm font-medium transition-colors',
                  tag === value
                    ? 'bg-turf-700 text-white'
                    : 'bg-surface text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
                )}
              >
                #{value}
              </button>
            ))}
          </div>
        )}
      </div>

      <ErrorAlert message={errorText(duplicatePlay.error ?? deletePlay.error)} />

      {plays.isPending ? (
        <PageSpinner />
      ) : plays.isError ? (
        <ErrorAlert message={errorText(plays.error)} />
      ) : plays.data.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={Search}
            title="Ninguna jugada coincide"
            description="Prueba con otra palabra o quita el filtro de etiqueta."
          />
        ) : (
          <EmptyState
            icon={Zap}
            title="Este playbook está vacío"
            description="Crea la primera jugada a partir de una formación y después dibuja las rutas y bloqueos."
            action={createButton}
          />
        )
      ) : (
        <motion.ul layout className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {plays.data.map((play) => (
              <motion.li
                key={play.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative"
              >
                <Link
                  to={`/teams/${teamId}/plays/${play.id}`}
                  className="flex h-full flex-col gap-2 rounded-3xl bg-surface p-5 pr-28 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                >
                  <span className="text-lg font-semibold">{play.name}</span>
                  {play.tags.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {play.tags.map((value) => (
                        <span
                          key={value}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          #{value}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="mt-auto text-xs text-slate-500">
                    Editada {formatDate(play.updatedAt)}
                  </span>
                </Link>
                <div className="absolute top-3 right-3 flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-turf-700 dark:hover:text-turf-300"
                    aria-label={`Duplicar ${play.name}`}
                    loading={duplicatePlay.isPending && duplicatePlay.variables === play.id}
                    onClick={() => duplicatePlay.mutate(play.id)}
                  >
                    {!(duplicatePlay.isPending && duplicatePlay.variables === play.id) && (
                      <Copy aria-hidden className="size-5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Borrar ${play.name}`}
                    onClick={() => setDeleting(play)}
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      {playbook.data && (
        <CreatePlayModal
          teamId={teamId}
          playbook={playbook.data}
          open={creating}
          onClose={() => setCreating(false)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="¿Borrar la jugada?"
        message={`«${deleting?.name ?? ''}» dejará de verse en el playbook.`}
        confirmLabel="Borrar"
        pending={deletePlay.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting && deletePlay.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  );
}

function CreatePlayModal({
  teamId,
  playbook,
  open,
  onClose,
}: {
  teamId: string;
  playbook: Playbook;
  open: boolean;
  onClose: () => void;
}) {
  const team = useQuery(queries.team(teamId));
  const createPlay = useCreatePlay(teamId, playbook.id);
  const navigate = useNavigate();
  const [formationId, setFormationId] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tags = String(form.get('tags'))
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    createPlay.mutate(
      {
        name: String(form.get('name')).trim(),
        ...(formationId ? { formationId } : {}),
        ...(tags.length > 0 ? { tags: [...new Set(tags)] } : {}),
      },
      { onSuccess: (play) => void navigate(`/teams/${teamId}/plays/${play.id}`) },
    );
  };

  return (
    <Modal open={open} title="Nueva jugada" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Nombre"
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder="Mesh Right"
        />
        <TextField
          label="Etiquetas (opcional)"
          name="tags"
          placeholder="red zone, 3rd down"
          hint="Sepáralas con comas."
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Formación de partida</legend>
          <FormationPicker
            teamId={teamId}
            side={playbook.side}
            ruleset={team.data?.ruleset ?? 'college'}
            value={formationId}
            onChange={setFormationId}
          />
        </fieldset>
        <ErrorAlert message={errorText(createPlay.error)} />
        <Button type="submit" size="lg" loading={createPlay.isPending}>
          Crear jugada
        </Button>
      </form>
    </Modal>
  );
}

const dateFormat = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
