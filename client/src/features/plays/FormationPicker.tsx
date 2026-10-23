import {
  type DiagramPlayer,
  formationSide,
  type PlaybookSide,
  type Ruleset,
} from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Square } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { PageSpinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import type { Formation } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { FieldPreview, type PreviewPlayer } from '../field/FieldPreview';
import { FIELD_WIDTH, type FieldWindow } from '../field/geometry';

/**
 * La misma ventana para todas las miniaturas, para compararlas a la misma escala: 15
 * yardas a cada lado de la LOS, o más si hay formaciones de retorno campo abajo.
 */
function pickerWindow(formations: readonly Formation[]): FieldWindow {
  const ys = formations.flatMap((formation) => formation.players.map((slot) => slot.y));
  if (ys.every((y) => Math.abs(y) <= 13)) return { minY: -15, maxY: 15 };
  return {
    minY: Math.min(-3, ...ys.map((y) => y - 3)),
    maxY: Math.max(3, ...ys.map((y) => y + 3)),
  };
}

export function formationPlayers(formation: Formation): PreviewPlayer[] {
  const side = formationSide(formation.players, formation.side);
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
  /** Solo las formaciones de ese lado (en special teams: O patea, D recibe). */
  unit?: DiagramPlayer['side'];
}

/** Elige la formación de partida viendo cómo queda en la cancha; o empieza con la cancha vacía. */
export function FormationPicker({
  teamId,
  side,
  ruleset,
  value,
  onChange,
  emptyLabel = 'Cancha vacía',
  unit,
}: FormationPickerProps) {
  const formations = useQuery(queries.formations(teamId, side));

  if (formations.isPending) return <PageSpinner label="Cargando formaciones…" />;

  const all = formations.data ?? [];
  const sideOf = (formation: Formation) => formationSide(formation.players, formation.side);
  // En special teams sin lado fijo, dos grupos: quien patea y quien recibe (campo abajo),
  // cada uno a su escala para que las miniaturas no queden diminutas.
  const groups: { title: string | null; options: (Formation | null)[] }[] =
    side === 'special' && unit === undefined
      ? [
          {
            title: 'Equipo que patea',
            options: [null, ...all.filter((formation) => sideOf(formation) === 'O')],
          },
          {
            title: 'Equipo que recibe',
            options: all.filter((formation) => sideOf(formation) === 'D'),
          },
        ]
      : [
          {
            title: null,
            options: [
              null,
              ...all.filter((formation) => unit === undefined || sideOf(formation) === unit),
            ],
          },
        ];

  return (
    <div role="radiogroup" aria-label="Formación" className="flex flex-col gap-4">
      {groups.map((group) => (
        <FormationGroup key={group.title ?? 'all'} title={group.title}>
          {group.options.map((formation, index) => {
            const window = pickerWindow(group.options.filter((option) => option !== null));
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
                    ? 'bg-turf-50 ring-turf-600 dark:bg-turf-900/50'
                    : 'bg-surface ring-slate-200 hover:ring-slate-300',
                )}
              >
                {formation ? (
                  <FieldPreview
                    players={formationPlayers(formation)}
                    ruleset={ruleset}
                    window={window}
                    animate={selected}
                    title={formation.name}
                  />
                ) : (
                  <div
                    className="grid place-items-center rounded-2xl bg-turf-700/80 text-white/80"
                    style={{ aspectRatio: `${FIELD_WIDTH} / ${window.maxY - window.minY}` }}
                  >
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
        </FormationGroup>
      ))}
    </div>
  );
}

function FormationGroup({ title, children }: { title: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <p className="text-sm font-semibold text-slate-600">{title}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </div>
  );
}
