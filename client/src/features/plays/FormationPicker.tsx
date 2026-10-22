import { diagramSideFor, type PlaybookSide, type Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { PageSpinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import type { Formation } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { FieldPreview, type PreviewPlayer } from '../field/FieldPreview';

const PICKER_WINDOW = { minY: -15, maxY: 15 };

export function formationPlayers(formation: Formation): PreviewPlayer[] {
  const side = diagramSideFor(formation.side);
  return formation.players.map((slot) => ({ ...slot, id: slot.slotId, side }));
}

interface FormationPickerProps {
  teamId: string;
  side: PlaybookSide;
  ruleset: Ruleset;
  value: string | null;
  onChange: (formationId: string | null, formation: Formation | null) => void;
  /** Texto de la opción sin formación. */
  emptyLabel?: string;
}

/** Elige la formación de partida viendo cómo queda en la cancha; o empieza con la cancha vacía. */
export function FormationPicker({
  teamId,
  side,
  ruleset,
  value,
  onChange,
  emptyLabel = 'Cancha vacía',
}: FormationPickerProps) {
  const formations = useQuery(queries.formations(teamId, side));

  if (formations.isPending) return <PageSpinner label="Cargando formaciones…" />;

  const options: (Formation | null)[] = [null, ...(formations.data ?? [])];
  return (
    <div role="radiogroup" aria-label="Formación" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((formation, index) => {
        const id = formation?.id ?? null;
        const selected = value === id;
        return (
          <motion.button
            key={id ?? 'empty'}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id, formation)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            whileTap={{ scale: 0.96 }}
            className={cn(
              'relative flex flex-col gap-2 rounded-2xl p-2 text-left ring-2 transition-colors',
              selected
                ? 'bg-turf-50 ring-turf-600'
                : 'bg-white ring-slate-200 hover:ring-slate-300',
            )}
          >
            {formation ? (
              <FieldPreview
                players={formationPlayers(formation)}
                ruleset={ruleset}
                window={PICKER_WINDOW}
                animate={selected}
                title={formation.name}
              />
            ) : (
              <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-turf-700/80 text-white/80">
                <Square aria-hidden className="size-8" />
              </div>
            )}
            <span className="px-1 text-sm font-semibold">
              {formation ? formation.name : emptyLabel}
              {formation && !formation.isGlobal && (
                <span className="ml-1 text-xs font-normal text-slate-500">(del equipo)</span>
              )}
            </span>
            {selected && (
              <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-turf-600 text-white">
                <Check aria-hidden className="size-4" />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
