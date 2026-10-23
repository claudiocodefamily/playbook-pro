import { type DiagramPlayer, goalPostsY } from '@playbook/shared';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { type BallAction, ballEntries } from '../field/ball';
import {
  addBallTransfer,
  addFieldGoal,
  addKickoff,
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
  kick: 'Recibe la patada',
  fumble: 'Recoge el fumble',
};

const GIVE_LABELS = { handoff: 'Handoff', pitch: 'Pitch', pass: 'Pase' } as const;
const SAME_SIDE_TRANSFERS = BALL_TRANSFERS.filter(
  (action): action is keyof typeof GIVE_LABELS => action !== 'kick',
);

/**
 * Qué hace este jugador con el balón: recibir el snap, un handoff, un pitch, un pase o
 * una patada del equipo contrario; y, si lo tiene y hay kicker, patear un field goal.
 */
export function BallSection({ player }: { player: DiagramPlayer }) {
  const timeline = useEditor((state) => state.diagram.ball.carrierTimeline);
  const players = useEditor((state) => state.diagram.players);
  const yardLine = useEditor((state) => state.diagram.field.yardLine);
  const entries = ballEntries({ ball: { carrierTimeline: timeline } });
  const apply = useEditor((state) => state.apply);
  const last = entries.at(-1);
  const holder = players.find((candidate) => candidate.id === last?.playerId);
  // Tras un field goal nadie tiene el balón: la jugada se acabó.
  const dead = last !== undefined && last.playerId === undefined;
  const hasSnap = entries.some((entry) => entry.action === 'snap');
  const kicker = players.some((candidate) => candidate.side === 'O' && candidate.position === 'K');
  // Patea siempre el equipo O (hacia y positivo): con kicker o punter en la cancha.
  const kickingUnit = players.some(
    (candidate) =>
      candidate.side === 'O' && (candidate.position === 'K' || candidate.position === 'P'),
  );
  // Lo suyo: lo que recibe y las patadas a portería que salen de sus manos.
  const own = entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry, index }) =>
        entry.playerId === player.id ||
        (entry.playerId === undefined && entries[index - 1]?.playerId === player.id),
    );

  const canSnap = entries.length === 0 && player.side === 'O';
  const canKickoff = entries.length === 0 && player.side === 'D' && kicker;
  const canReceive = !dead && holder !== undefined && holder.id !== player.id;
  const canReceiveKick = canReceive && kickingUnit && holder.side === 'O' && player.side === 'D';
  const canFieldGoal = !dead && holder?.id === player.id && player.side === 'O' && kicker;
  const fieldGoalReach = goalPostsY(yardLine);
  const canTakeSnap =
    hasSnap && own.length === 0 && holder?.id !== player.id && player.side === 'O';

  const canGive = canReceive && holder.side === player.side;
  if (own.length === 0 && !canSnap && !canKickoff && !canReceiveKick && !canGive && !canFieldGoal) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 border-t border-slate-200 pt-3">
      <h3 className="text-sm font-semibold text-slate-700">Balón</h3>

      {own.map(({ entry, index }) => (
        <div
          key={`${index}-${entry.t}`}
          className="flex flex-col gap-1 rounded-xl bg-amber-50 p-2 dark:bg-amber-950/40"
        >
          <div className="flex items-center justify-between gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <span>
              {entry.playerId === undefined
                ? 'Field goal'
                : index === 0 && entry.action === 'kick'
                  ? 'Recibe el kickoff'
                  : RECEIVES[entry.action ?? 'handoff']}
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

      {canSnap && (
        <Button
          variant="secondary"
          onClick={() => apply((diagram) => setSnapReceiver(diagram, player.id))}
        >
          Recibe el snap
        </Button>
      )}

      {canKickoff && (
        <Button
          variant="secondary"
          onClick={() => apply((diagram) => addKickoff(diagram, player.id) ?? diagram)}
        >
          Recibe el kickoff
        </Button>
      )}

      {canReceiveKick && (
        <>
          <p className="text-xs text-slate-500">
            El balón lo tiene el equipo contrario: que se lo patee a él (punt o kickoff).
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              apply((diagram) => addBallTransfer(diagram, player.id, 'kick') ?? diagram)
            }
          >
            Recibe la patada
          </Button>
        </>
      )}

      {canGive && (
        <>
          <p className="text-xs text-slate-500">
            Darle el balón: handoff (entrega en mano), pitch (lateral hacia atrás) o pase.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {SAME_SIDE_TRANSFERS.map((action) => (
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
      )}

      {canFieldGoal && (
        <>
          <p className="text-xs text-slate-500">
            Field goal o PAT (extra point): el kicker patea el balón desde aquí entre los postes.
          </p>
          <Button
            variant="secondary"
            disabled={fieldGoalReach > 75}
            title={fieldGoalReach > 75 ? 'Los postes quedan a más de 75 yardas' : undefined}
            onClick={() => apply((diagram) => addFieldGoal(diagram) ?? diagram)}
          >
            Field goal ({Math.round(fieldGoalReach)} yd)
          </Button>
        </>
      )}

      {canTakeSnap && (
        <button
          type="button"
          className="self-start text-xs font-medium text-turf-700 underline dark:text-turf-300"
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
