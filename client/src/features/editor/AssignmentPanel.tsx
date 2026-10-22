import { Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/field';
import { cn } from '../../lib/cn';
import { type CoverageAssignment } from '../field/coverage';
import { isPathAssignment, type PathAssignment } from '../field/paths';
import { removeAssignment, updateAssignment, updateZone } from './diagram-ops';
import { useEditor } from './editor-context';

const TYPE_LABELS: Readonly<Record<PathAssignment['type'], string>> = {
  route: 'Ruta',
  block: 'Bloqueo',
  motion: 'Motion',
  blitz: 'Blitz',
};

/** Las rutas del route tree más usadas, para nombrarlas con un toque. */
const ROUTE_NAMES = [
  'Flat',
  'Slant',
  'Hitch',
  'Out',
  'Dig',
  'Curl',
  'Comeback',
  'Corner',
  'Post',
  'Go',
  'Seam',
  'Wheel',
  'Drag',
  'Screen',
] as const;

const LINE_OPTIONS: readonly { value: PathAssignment['style']['line']; label: string }[] = [
  { value: 'solid', label: 'Continua' },
  { value: 'dashed', label: 'Discontinua' },
  { value: 'dotted', label: 'Punteada' },
];

const END_OPTIONS: readonly { value: PathAssignment['style']['end']; label: string }[] = [
  { value: 'arrow', label: 'Flecha' },
  { value: 'block', label: 'T de bloqueo' },
  { value: 'none', label: 'Sin final' },
];

/** Estilo, nombre y borrado de la ruta, bloqueo, motion o blitz seleccionado. */
export function AssignmentPanel() {
  const assignment = useEditor((state) =>
    state.diagram.assignments.find((candidate) => candidate.id === state.selectedAssignmentId),
  );
  const player = useEditor((state) =>
    state.diagram.players.find((candidate) => candidate.id === assignment?.playerId),
  );
  const apply = useEditor((state) => state.apply);
  if (!assignment) return null;
  if (!isPathAssignment(assignment)) return <CoveragePanel coverage={assignment} />;
  const { style } = assignment;
  const update = (changes: Parameters<typeof updateAssignment>[2]) =>
    apply((diagram) => updateAssignment(diagram, assignment.id, changes));

  return (
    <motion.div
      key={assignment.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-4"
    >
      <h2 className="font-semibold">
        {TYPE_LABELS[assignment.type]}
        {player && <span className="font-normal text-slate-500"> de {player.label}</span>}
      </h2>

      {assignment.type === 'route' && (
        <div className="flex flex-col gap-2">
          <TextField
            label="Nombre de la ruta"
            value={assignment.routeName ?? ''}
            maxLength={30}
            placeholder="Slant, Post…"
            onChange={(event) => update({ routeName: event.target.value })}
          />
          <div className="flex flex-wrap gap-1.5">
            {ROUTE_NAMES.map((name) => (
              <Chip
                key={name}
                active={assignment.routeName === name}
                onClick={() => update({ routeName: assignment.routeName === name ? '' : name })}
              >
                {name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <OptionGroup
        label="Trazo"
        options={LINE_OPTIONS}
        value={style.line}
        onChange={(line) => update({ style: { ...style, line } })}
      />
      <OptionGroup
        label="Final"
        options={END_OPTIONS}
        value={style.end}
        onChange={(end) => update({ style: { ...style, end } })}
      />
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5 accent-turf-700"
          checked={style.curved}
          onChange={(event) => update({ style: { ...style, curved: event.target.checked } })}
        />
        Suavizar las curvas
      </label>

      <Button
        variant="secondary"
        className="text-red-700"
        onClick={() => apply((diagram) => removeAssignment(diagram, assignment.id))}
      >
        <Trash2 aria-hidden className="size-4" />
        Borrar {TYPE_LABELS[assignment.type].toLowerCase()}
      </Button>
    </motion.div>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Chip
            key={option.value}
            active={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-full px-3 text-sm font-medium ring-1 transition-colors',
        active
          ? 'bg-turf-700 text-white ring-turf-700'
          : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

/** Nombres habituales de las zonas, de las profundas a las cortas. */
const ZONE_NAMES = [
  'Deep half',
  'Deep third',
  'Deep middle',
  'Flat',
  'Curl/Flat',
  'Hook/Curl',
  'Middle hook',
] as const;

/** Marcaje (man) o zona de un defensor: a quién cubre, o nombre y tamaño de la zona. */
function CoveragePanel({ coverage }: { coverage: CoverageAssignment }) {
  const players = useEditor((state) => state.diagram.players);
  const apply = useEditor((state) => state.apply);
  const defender = players.find((player) => player.id === coverage.playerId);
  const remove = () => apply((diagram) => removeAssignment(diagram, coverage.id));

  return (
    <motion.div
      key={coverage.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-4"
    >
      <h2 className="font-semibold">
        {coverage.type === 'man' ? 'Marcaje (man)' : 'Zona'}
        {defender && <span className="font-normal text-slate-500"> de {defender.label}</span>}
      </h2>

      {coverage.type === 'man' ? (
        <p className="text-sm text-slate-600">
          Cubre a{' '}
          <strong>
            {players.find((player) => player.id === coverage.targetPlayerId)?.label ?? '?'}
          </strong>{' '}
          toda la jugada, también si hace motion antes del snap. En la animación lo sigue pegado por
          el mismo lado por el que empezó.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Tras el snap cae a su zona y se acerca al receptor que entra en ella. Arrastra la zona
            en la cancha para moverla.
          </p>
          <div className="flex flex-col gap-2">
            <TextField
              label="Nombre de la zona"
              value={coverage.zone.name ?? ''}
              maxLength={30}
              placeholder="Deep third, Flat…"
              onChange={(event) =>
                apply((diagram) => updateZone(diagram, coverage.id, { name: event.target.value }))
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {ZONE_NAMES.map((name) => (
                <Chip
                  key={name}
                  active={coverage.zone.name === name}
                  onClick={() =>
                    apply((diagram) =>
                      updateZone(diagram, coverage.id, {
                        name: coverage.zone.name === name ? '' : name,
                      }),
                    )
                  }
                >
                  {name}
                </Chip>
              ))}
            </div>
          </div>
          <SizeSlider
            label="Ancho"
            value={coverage.zone.width}
            min={4}
            max={30}
            onCommit={(width) => apply((diagram) => updateZone(diagram, coverage.id, { width }))}
          />
          <SizeSlider
            label="Profundidad"
            value={coverage.zone.depth}
            min={3}
            max={25}
            onCommit={(depth) => apply((diagram) => updateZone(diagram, coverage.id, { depth }))}
          />
        </>
      )}

      <Button variant="secondary" className="text-red-700" onClick={remove}>
        <Trash2 aria-hidden className="size-4" />
        Quitar {coverage.type === 'man' ? 'marcaje' : 'zona'}
      </Button>
    </motion.div>
  );
}

/** Se aplica al soltar, así arrastrar el control deja un solo paso en "Deshacer". */
function SizeSlider({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums text-slate-500">{draft} yd</span>
      </span>
      <input
        type="range"
        className="h-8 accent-turf-700"
        min={min}
        max={max}
        step={1}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  );
}
