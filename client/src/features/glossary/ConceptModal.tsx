import { PLAYBOOK_SIDES, type PlaybookSide } from '@playbook/shared';
import { Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { SelectField, TextAreaField, TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import type { ConceptInput } from '../../lib/api/endpoints';
import { useDeleteConcept, useSaveConcept } from '../../lib/api/queries';
import type { Concept } from '../../lib/api/types';
import { errorText } from '../../lib/errors';
import { CONCEPT_SIDE_LABELS } from './labels';

/** Qué se edita: un concepto del equipo, o uno nuevo (vacío o copiado de uno global). */
export type ConceptDraft = { concept: Concept } | { initial: Partial<ConceptInput> };

interface ConceptModalProps {
  teamId: string;
  draft: ConceptDraft | null;
  onClose: () => void;
}

export function ConceptModal({ teamId, draft, onClose }: ConceptModalProps) {
  const editing = draft && 'concept' in draft ? draft.concept : null;
  return (
    <Modal
      open={draft !== null}
      title={editing ? 'Editar concepto' : 'Nuevo concepto'}
      onClose={onClose}
    >
      {draft && (
        <ConceptForm
          // El formulario empieza de cero con cada concepto.
          key={editing?.id ?? JSON.stringify(draft)}
          teamId={teamId}
          draft={draft}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ConceptForm({
  teamId,
  draft,
  onClose,
}: {
  teamId: string;
  draft: ConceptDraft;
  onClose: () => void;
}) {
  const concept = 'concept' in draft ? draft.concept : null;
  const initial = concept ?? ('initial' in draft ? draft.initial : {});
  const save = useSaveConcept(teamId);
  const remove = useDeleteConcept(teamId);
  const [name, setName] = useState(initial.name ?? '');
  const [side, setSide] = useState<PlaybookSide>(initial.side ?? 'offense');
  const [explanation, setExplanation] = useState(initial.explanation ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(
      {
        id: concept?.id ?? null,
        input: { name: name.trim(), side, explanation: explanation.trim() },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
          <TextField
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
            placeholder="Y-Cross, Cover 6…"
            autoFocus
          />
          <SelectField
            label="Unidad"
            value={side}
            onChange={(event) => setSide(event.target.value as PlaybookSide)}
          >
            {PLAYBOOK_SIDES.map((option) => (
              <option key={option} value={option}>
                {CONCEPT_SIDE_LABELS[option]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextAreaField
          label="Explicación"
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          required
          maxLength={2000}
          rows={6}
          hint="Cómo se lo explicarías a un jugador: qué hace cada uno y contra qué funciona."
        />

        <ErrorAlert message={errorText(save.error)} />
        <div className="flex gap-2">
          {concept && (
            <Button
              variant="secondary"
              className="text-red-700 dark:text-red-300"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden className="size-4" />
              Borrar
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={save.isPending}>
            {concept ? 'Guardar' : 'Añadir al glosario'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Borrar el concepto?"
        message={`${concept?.name ?? ''} desaparecerá del glosario y de las jugadas que lo enseñan. Las jugadas no se borran.`}
        confirmLabel="Borrar"
        pending={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          concept &&
          remove.mutate(concept.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />
    </>
  );
}
