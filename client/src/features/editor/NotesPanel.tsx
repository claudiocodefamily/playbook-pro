import { useQuery } from '@tanstack/react-query';
import { BookMarked, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { TextAreaField } from '../../components/ui/field';
import { queries } from '../../lib/api/queries';
import type { Concept } from '../../lib/api/types';
import { CONCEPT_SIDE_LABELS, normalize } from '../glossary/labels';
import { MAX_NOTES, setNotes } from './diagram-ops';
import { useEditor } from './editor-context';

/** Cuántas sugerencias enseña el buscador de conceptos. */
const MAX_SUGGESTIONS = 6;

interface NotesPanelProps {
  teamId: string;
  playId: string;
  onSaveConcepts: (conceptIds: string[]) => Promise<boolean>;
}

/** Notas de la jugada y conceptos del glosario que enseña. */
export function NotesPanel({ teamId, playId, onSaveConcepts }: NotesPanelProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-4 ring-1 ring-slate-200">
      <h2 className="font-semibold">Notas y conceptos</h2>
      <NotesField />
      <ConceptsField teamId={teamId} playId={playId} onSave={onSaveConcepts} />
    </section>
  );
}

/** Se aplica al salir del cuadro: así escribir deja un solo paso en "Deshacer". */
function NotesField() {
  const notes = useEditor((state) => state.diagram.notes);
  const apply = useEditor((state) => state.apply);
  const [draft, setDraft] = useState(notes);
  const [seen, setSeen] = useState(notes);
  if (seen !== notes) {
    // Deshacer, rehacer o restaurar una versión cambian las notas desde fuera.
    setSeen(notes);
    setDraft(notes);
  }
  return (
    <TextAreaField
      label="Notas"
      value={draft}
      maxLength={MAX_NOTES}
      rows={4}
      placeholder="Lectura del QB, ajustes contra blitz, coaching points…"
      hint="Se ven en el modo presentación."
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => apply((diagram) => setNotes(diagram, draft))}
    />
  );
}

function ConceptsField({
  teamId,
  playId,
  onSave,
}: {
  teamId: string;
  playId: string;
  onSave: (conceptIds: string[]) => Promise<boolean>;
}) {
  const play = useQuery(queries.play(teamId, playId));
  const concepts = useQuery(queries.concepts(teamId));
  // Mientras se guarda, se enseña ya el cambio; si falla, vuelve a lo guardado.
  const [pending, setPending] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');
  const selected = pending ?? play.data?.conceptIds ?? [];
  const byId = new Map((concepts.data ?? []).map((concept) => [concept.id, concept]));

  const change = (conceptIds: string[]) => {
    setPending(conceptIds);
    void onSave(conceptIds).finally(() => setPending(null));
  };

  const query = normalize(search.trim());
  const suggestions = query
    ? (concepts.data ?? [])
        .filter((concept) => !selected.includes(concept.id))
        .filter((concept) => normalize(concept.name).includes(query))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Conceptos que enseña</span>
        <Link
          to={`/teams/${teamId}/glossary`}
          className="flex items-center gap-1 text-xs font-semibold text-turf-700 hover:underline dark:text-turf-300"
        >
          <BookMarked aria-hidden className="size-3.5" />
          Glosario
        </Link>
      </div>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Conceptos de la jugada">
          {selected.map((conceptId) => {
            const concept = byId.get(conceptId);
            return (
              <li key={conceptId}>
                <span
                  className="flex min-h-8 items-center gap-1 rounded-full bg-turf-700 pr-1 pl-3 text-sm font-semibold text-white"
                  title={concept?.explanation}
                >
                  {concept?.name ?? '…'}
                  <button
                    type="button"
                    aria-label={`Quitar ${concept?.name ?? 'concepto'}`}
                    onClick={() => change(selected.filter((id) => id !== conceptId))}
                    className="grid size-6 place-items-center rounded-full hover:bg-white/20"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="relative">
        <label className="sr-only" htmlFor="concept-search">
          Añadir concepto
        </label>
        <input
          id="concept-search"
          type="search"
          value={search}
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Añadir: Mesh, Cover 3…"
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-surface px-3 text-base shadow-sm focus:border-turf-600 focus:ring-2 focus:ring-turf-600/30 focus:outline-none"
        />
        {query && (
          <ul
            aria-label="Sugerencias"
            className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-slate-200"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-500">
                No está en el glosario. Añádelo desde la pestaña Glosario.
              </li>
            ) : (
              suggestions.map((concept) => (
                <Suggestion
                  key={concept.id}
                  concept={concept}
                  onPick={() => {
                    change([...selected, concept.id]);
                    setSearch('');
                  }}
                />
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function Suggestion({ concept, onPick }: { concept: Concept; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-slate-50"
      >
        <Plus aria-hidden className="size-4 text-turf-700 dark:text-turf-300" />
        <span className="font-semibold">{concept.name}</span>
        <span className="ml-auto text-xs text-slate-500">{CONCEPT_SIDE_LABELS[concept.side]}</span>
      </button>
    </li>
  );
}

/** Notas y conceptos junto a la cancha en el modo presentación. */
export function PresentationNotes({ teamId, playId }: { teamId: string; playId: string }) {
  const notes = useEditor((state) => state.diagram.notes);
  const play = useQuery(queries.play(teamId, playId));
  const concepts = useQuery(queries.concepts(teamId));
  const linked = (play.data?.conceptIds ?? []).flatMap((id) => {
    const concept = concepts.data?.find((candidate) => candidate.id === id);
    return concept ? [concept] : [];
  });
  if (!notes.trim() && linked.length === 0) return null;
  return (
    <aside className="flex flex-col gap-4 rounded-2xl bg-black/25 p-4 text-white lg:w-80 lg:shrink-0 lg:self-start">
      {linked.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wide text-white/60 uppercase">Conceptos</h3>
          <ul className="flex flex-col gap-2">
            {linked.map((concept) => (
              <li key={concept.id}>
                <p className="text-lg font-bold">{concept.name}</p>
                <p className="text-sm leading-snug text-white/80">{concept.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.trim() && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-bold tracking-wide text-white/60 uppercase">Notas</h3>
          <p className="text-base leading-relaxed whitespace-pre-line">{notes}</p>
        </div>
      )}
    </aside>
  );
}
