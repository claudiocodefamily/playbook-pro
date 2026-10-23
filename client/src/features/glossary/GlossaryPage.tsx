import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { BookMarked, ChevronDown, Copy, Pencil, Plus, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { TeamNav } from '../../components/TeamNav';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { PageSpinner, Spinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import type { Concept } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { type ConceptDraft, ConceptModal } from './ConceptModal';
import { CONCEPT_SIDE_LABELS, normalize } from './labels';

const FILTERS: readonly { id: PlaybookSide | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  ...PLAYBOOK_SIDES.map((side) => ({ id: side, label: CONCEPT_SIDE_LABELS[side] })),
];

/** Glosario del equipo: conceptos globales y propios, y qué jugadas enseñan cada uno. */
export function GlossaryPage() {
  const { teamId = '' } = useParams();
  const team = useQuery(queries.team(teamId));
  const concepts = useQuery(queries.concepts(teamId));
  const [filter, setFilter] = useState<PlaybookSide | 'all'>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<ConceptDraft | null>(null);

  const query = normalize(search.trim());
  const visible = (concepts.data ?? []).filter(
    (concept) =>
      (filter === 'all' || concept.side === filter) &&
      (!query ||
        normalize(concept.name).includes(query) ||
        normalize(concept.explanation).includes(query)),
  );
  const addButton = (
    <Button onClick={() => setDraft({ initial: filter === 'all' ? {} : { side: filter } })}>
      <Plus aria-hidden className="size-4" />
      Añadir concepto
    </Button>
  );

  return (
    <>
      <PageHeader
        title={team.data?.name ?? 'Equipo'}
        subtitle="Glosario del equipo"
        back={{ to: '/', label: 'Mis equipos' }}
        actions={addButton}
      />
      <TeamNav teamId={teamId} />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Unidad" className="flex flex-wrap gap-2">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                'relative min-h-11 rounded-full px-5 text-sm font-semibold transition-colors',
                filter === id
                  ? 'text-white'
                  : 'bg-surface text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
              )}
            >
              {filter === id && (
                <motion.span
                  layoutId="glossary-filter"
                  className="absolute inset-0 rounded-full bg-turf-700"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1 lg:max-w-xs">
          <span className="sr-only">Buscar concepto</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mesh, cover, blitz…"
            className="min-h-11 w-full rounded-full border border-slate-300 bg-surface pr-4 pl-10 text-base shadow-sm focus:border-turf-600 focus:ring-2 focus:ring-turf-600/30 focus:outline-none"
          />
        </label>
      </div>

      {concepts.isPending ? (
        <PageSpinner />
      ) : concepts.isError ? (
        <ErrorAlert message={errorText(concepts.error)} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="Ningún concepto coincide"
          description="Prueba con otra palabra o cambia la unidad. Si es un concepto vuestro, añádelo al glosario."
          action={addButton}
        />
      ) : (
        <motion.ul layout className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((concept) => (
              <motion.li
                key={concept.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
              >
                <ConceptCard
                  teamId={teamId}
                  concept={concept}
                  onEdit={() => setDraft({ concept })}
                  onCopy={() =>
                    setDraft({
                      initial: {
                        name: `${concept.name} (equipo)`,
                        side: concept.side,
                        explanation: concept.explanation,
                      },
                    })
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <ConceptModal teamId={teamId} draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

function ConceptCard({
  teamId,
  concept,
  onEdit,
  onCopy,
}: {
  teamId: string;
  concept: Concept;
  onEdit: () => void;
  onCopy: () => void;
}) {
  const [showPlays, setShowPlays] = useState(false);
  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-slate-200">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{concept.name}</h2>
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              {CONCEPT_SIDE_LABELS[concept.side]}
            </span>
            {!concept.isGlobal && (
              <span className="rounded-full bg-turf-100 px-2 py-0.5 text-turf-800 dark:bg-turf-900/60 dark:text-turf-100">
                Del equipo
              </span>
            )}
          </p>
        </div>
        {concept.isGlobal ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopy}
            aria-label={`Copiar ${concept.name} al equipo`}
            title="Copiar al equipo para cambiarlo"
          >
            <Copy aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={`Editar ${concept.name}`}
            title="Editar"
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
        )}
      </header>
      <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
        {concept.explanation}
      </p>
      {concept.playCount > 0 ? (
        <div>
          <button
            type="button"
            aria-expanded={showPlays}
            onClick={() => setShowPlays((value) => !value)}
            className="flex min-h-9 items-center gap-1 text-sm font-semibold text-turf-700 hover:underline dark:text-turf-300"
          >
            {concept.playCount === 1 ? '1 jugada' : `${concept.playCount} jugadas`}
            <ChevronDown
              aria-hidden
              className={cn('size-4 transition-transform', showPlays && 'rotate-180')}
            />
          </button>
          {showPlays && <ConceptPlays teamId={teamId} conceptId={concept.id} />}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Aún no lo enseña ninguna jugada.</p>
      )}
    </article>
  );
}

function ConceptPlays({ teamId, conceptId }: { teamId: string; conceptId: string }) {
  const plays = useQuery(queries.conceptPlays(teamId, conceptId));
  if (plays.isPending) return <Spinner className="m-2 size-5" />;
  if (plays.isError) return <ErrorAlert message={errorText(plays.error)} />;
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {plays.data.map((play) => (
        <li key={play.id}>
          <Link
            to={`/teams/${teamId}/plays/${play.id}`}
            className="flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {play.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
