import { useQuery } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { SelectField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { Spinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import { errorText } from '../../lib/errors';

/**
 * Elegir jugadas de cualquier playbook del equipo. Se queda abierto para añadir varias
 * seguidas; las que ya están en la situación salen marcadas.
 */
export function PlayPicker({
  teamId,
  title,
  chosen,
  onAdd,
  onClose,
}: {
  teamId: string;
  title: string;
  chosen: readonly string[];
  onAdd: (playId: string) => void;
  onClose: () => void;
}) {
  const playbooks = useQuery(queries.playbooks(teamId));
  const [picked, setPicked] = useState('');
  const playbookId = picked || playbooks.data?.[0]?.id || '';
  const plays = useQuery({ ...queries.plays(teamId, playbookId), enabled: Boolean(playbookId) });
  const sorted = [...(plays.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Modal open title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <SelectField
          label="Playbook"
          value={playbookId}
          onChange={(event) => setPicked(event.target.value)}
        >
          {(playbooks.data ?? []).map((playbook) => (
            <option key={playbook.id} value={playbook.id}>
              {playbook.name}
            </option>
          ))}
        </SelectField>
        <ErrorAlert message={errorText(plays.error ?? playbooks.error)} />
        {playbooks.isPending || (plays.isPending && playbookId) ? (
          <Spinner />
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-500">Este playbook no tiene jugadas.</p>
        ) : (
          <ul className="flex max-h-[50dvh] flex-col gap-1 overflow-y-auto">
            {sorted.map((play) => {
              const added = chosen.includes(play.id);
              return (
                <li key={play.id}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => onAdd(play.id)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left hover:bg-slate-50 disabled:text-slate-500"
                  >
                    {added ? (
                      <Check aria-hidden className="size-4 text-turf-700 dark:text-turf-300" />
                    ) : (
                      <Plus aria-hidden className="size-4 text-turf-700 dark:text-turf-300" />
                    )}
                    <span className="font-medium">{play.name}</span>
                    {added && <span className="ml-auto text-xs">Añadida</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button onClick={onClose}>Listo</Button>
      </div>
    </Modal>
  );
}
