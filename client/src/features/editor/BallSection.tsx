import type { DiagramPlayer } from '@playbook/shared';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { type BallAction, ballEntries } from '../field/ball';
import {
  addBallTransfer,
  BALL_TRANSFERS,
  removeBallEntry,
  setBallTime,
  setSnapReceiver,
} from './diagram-ops';
import { useEditor } from './editor-context';

const RECEIVES: Readonly<Record<BallAction, string>> = {
  snap: 'Recibe el snap',
  handoff: 'Recibe el handoff',
  pitch: 'Recibe el pitch',
  pass: 'Recibe el pase',
  fumble: 'Recoge el fumble',
};

const GIVE_LABELS = { handoff: 'Handoff', pitch: 'Pitch', pass: 'Pase' } as const;

/** Qué hace este jugador con el balón: recibir el snap, un handoff, un pitch o un pase. */
export function BallSection({ player }: { player: DiagramPlayer }) {
  const timeline = useEditor((state) => state.diagram.ball.carrierTimeline);
  const entries = ballEntries({ ball: { carrierTimeline: timeline } });
  const apply = useEditor((state) => state.apply);
  const hasSnap = entries.some((entry) => entry.action === 'snap');
  const holder = entries.at(-1)?.playerId;
  const own = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.playerId === player.id);

  return (
    <section className="flex flex-col gap-2 border-t border-slate-200 pt-3">
      <h3 className="text-sm font-semibold text-slate-700">Balón</h3>

      {own.map(({ entry, index }) => (
        <div key={`${index}-${entry.t}`} className="flex flex-col gap-1 rounded-xl bg-amber-50 p-2">
          <div className="flex items-center justify-between gap-2 text-sm font-medium text-amber-900">
            <span>
              {RECEIVES[entry.action ?? 'handoff']}
              {entry.action !== 'snap' && ` · sale a los ${entry.t.toFixed(1)} s`}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 min-h-9"
              aria-label="Quitar este cambio de manos"
              title="Quitar (y lo que venía después)"
              onClick={() => apply((diagram) => removeBallEntry(diagram, index))}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>
          {entry.action !== 'snap' && (
            <BallTimeSlider
              initial={entry.t}
              onCommit={(t) => apply((diagram) => setBallTime(diagram, index, t))}
            />
          )}
        </div>
      ))}

      {!hasSnap ? (
        <Button
          variant="secondary"
          onClick={() => apply((diagram) => setSnapReceiver(diagram, player.id))}
        >
          Recibe el snap
        </Button>
      ) : holder !== player.id ? (
        <>
          <p className="text-xs text-slate-500">
            Darle el balón: handoff (entrega en mano), pitch (lateral hacia atrás) o pase.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {BALL_TRANSFERS.map((action) => (
              <Button
                key={action}
                variant="secondary"
                className="px-2"
                onClick={() =>
                  apply((diagram) => addBallTransfer(diagram, player.id, action) ?? diagram)
                }
              >
                {GIVE_LABELS[action]}
              </Button>
            ))}
          </div>
        </>
      ) : null}

      {hasSnap && own.length === 0 && holder !== player.id && (
        <button
          type="button"
          className="self-start text-xs font-medium text-turf-700 underline"
          onClick={() => apply((diagram) => setSnapReceiver(diagram, player.id))}
        >
          O que reciba él el snap
        </button>
      )}
    </section>
  );
}

/** Se aplica al soltar, así arrastrar el control deja un solo paso en "Deshacer". */
function BallTimeSlider({ initial, onCommit }: { initial: number; onCommit: (t: number) => void }) {
  const [value, setValue] = useState(initial);
  const commit = () => {
    if (value !== initial) onCommit(value);
  };
  return (
    <input
      type="range"
      aria-label="Cuándo sale el balón"
      className="h-8 accent-amber-600"
      min={0.4}
      max={8}
      step={0.1}
      value={value}
      onChange={(event) => setValue(Number(event.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}
