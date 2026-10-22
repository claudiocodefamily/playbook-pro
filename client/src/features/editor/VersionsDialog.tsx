import type { PlayDiagram, Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { Modal } from '../../components/ui/modal';
import { Spinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { FieldPreview } from '../field/FieldPreview';
import { fitWindow } from '../field/geometry';

const DATE_FORMAT = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

interface VersionsDialogProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  playId: string;
  ruleset: Ruleset;
  onRestore: (diagram: PlayDiagram) => void;
}

/** Historial de "Guardar versión": ver cómo estaba la jugada y volver a esa versión. */
export function VersionsDialog({
  open,
  onClose,
  teamId,
  playId,
  ruleset,
  onRestore,
}: VersionsDialogProps) {
  const versions = useQuery({ ...queries.playVersions(teamId, playId), enabled: open });
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? versions.data?.[0]?.version ?? null;
  const version = useQuery({
    ...queries.playVersion(teamId, playId, selected ?? 0),
    enabled: open && selected !== null,
  });

  return (
    <Modal open={open} title="Historial de versiones" onClose={onClose}>
      {versions.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : versions.isError ? (
        <ErrorAlert message={errorText(versions.error)} />
      ) : versions.data.length === 0 ? (
        <EmptyState
          icon={History}
          title="Todavía no hay versiones"
          description="Pulsa «Guardar versión» cuando la jugada esté lista para tener una copia a la que volver."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <AnimatePresence mode="wait">
              {version.data ? (
                <motion.div
                  key={version.data.version}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <FieldPreview
                    players={version.data.diagram.players}
                    assignments={version.data.diagram.assignments}
                    ruleset={ruleset}
                    window={fitWindow([
                      ...version.data.diagram.players,
                      ...version.data.diagram.assignments.flatMap((a) => a.points),
                    ])}
                    title={`Versión ${version.data.version}`}
                  />
                </motion.div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-turf-700">
                  <Spinner className="text-white" />
                </div>
              )}
            </AnimatePresence>
          </div>

          <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {versions.data.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-pressed={entry.version === selected}
                  onClick={() => setPicked(entry.version)}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm ring-1',
                    entry.version === selected
                      ? 'bg-turf-50 font-semibold text-turf-900 ring-turf-600'
                      : 'bg-white ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  <span>
                    Versión {entry.version} · {entry.name}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {DATE_FORMAT.format(new Date(entry.createdAt))}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {version.isError && <ErrorAlert message={errorText(version.error)} />}
          <Button
            disabled={!version.data}
            onClick={() => {
              if (!version.data) return;
              onRestore(version.data.diagram);
              onClose();
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
            Volver a esta versión
          </Button>
          <p className="text-center text-xs text-slate-500">
            Si te equivocas, puedes deshacerlo con «Deshacer».
          </p>
        </div>
      )}
    </Modal>
  );
}
