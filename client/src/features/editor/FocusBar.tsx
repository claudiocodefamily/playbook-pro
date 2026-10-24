import { POSITIONS, type Position } from '@playbook/shared';
import { UserRound, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { useEditor } from './editor-context';
import { describeAssignments, focusedIds, positionFocus } from './focus';

/**
 * Modo jugador: eliges un jugador (o una posición) y la cancha resalta solo su tarea.
 * Con un jugador, además se explica en frases lo que tiene que hacer.
 */
export function FocusBar({ large = false }: { large?: boolean }) {
  const diagram = useEditor((state) => state.diagram);
  const focus = useEditor((state) => state.focus);
  const setFocus = useEditor((state) => state.setFocus);
  if (diagram.players.length === 0) return null;

  const active = focusedIds(diagram, focus) ? focus : null;
  const player = diagram.players.find((candidate) => candidate.id === active);
  const steps = player ? describeAssignments(diagram, player.id) : [];
  const sides = (['O', 'D'] as const)
    .map((side) => ({
      side,
      players: diagram.players
        .filter((candidate) => candidate.side === side)
        .sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .filter((group) => group.players.length > 0);
  // Solo las posiciones con varios jugadores: la línea ofensiva, los receptores...
  const positions = POSITIONS.filter(
    (position: Position) =>
      diagram.players.filter((candidate) => candidate.position === position).length > 1,
  );

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl bg-black/25 p-2 text-white sm:flex-row sm:items-start',
        large && 'text-lg',
      )}
    >
      <div className="flex shrink-0 items-center gap-1">
        <label className="flex items-center gap-2">
          <UserRound aria-hidden className="size-4 text-white/70" />
          <span className="text-sm font-semibold whitespace-nowrap">Modo jugador</span>
          <select
            value={active ?? ''}
            onChange={(event) => setFocus(event.target.value || null)}
            className="min-h-10 rounded-xl bg-surface px-2 text-sm font-semibold text-slate-900 ring-1 ring-white/20"
          >
            <option value="">Todos</option>
            {sides.map((group) => (
              <optgroup key={group.side} label={group.side === 'O' ? 'Ataque' : 'Defensa'}>
                {group.players.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                    {candidate.label !== candidate.position ? ` (${candidate.position})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
            {positions.length > 0 && (
              <optgroup label="Por posición">
                {positions.map((position) => (
                  <option key={position} value={positionFocus(position)}>
                    Todos los {position}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {active && (
          <button
            type="button"
            onClick={() => setFocus(null)}
            aria-label="Salir del modo jugador"
            className="grid size-9 place-items-center rounded-full hover:bg-white/10"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">
        {player && (
          <motion.ol
            key={player.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            aria-label={`Tarea de ${player.label}`}
            className="flex flex-wrap items-center gap-1.5 sm:pt-1"
          >
            {steps.length === 0 ? (
              <li className="text-sm text-white/70">
                {player.label} aún no tiene tarea en esta jugada.
              </li>
            ) : (
              steps.map((step, index) => (
                <li
                  key={step}
                  className={cn(
                    'rounded-full bg-amber-400 px-3 py-0.5 font-semibold text-amber-950',
                    large ? 'text-base' : 'text-sm',
                  )}
                >
                  {index + 1}. {step}
                </li>
              ))
            )}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
