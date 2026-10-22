import { POSITIONS, type Position } from '@playbook/shared';
import { MousePointerClick, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { SelectField, TextField } from '../../components/ui/field';
import { AssignmentPanel } from './AssignmentPanel';
import { BallSection } from './BallSection';
import { removePlayer, updatePlayer } from './diagram-ops';
import { useEditor } from './editor-context';

/**
 * Panel de lo seleccionado: datos del jugador (etiqueta, posición, dorsal) o estilo de su
 * ruta o bloqueo.
 */
export function PlayerPanel() {
  const selectedAssignmentId = useEditor((state) => state.selectedAssignmentId);
  const player = useEditor((state) =>
    state.diagram.players.find((candidate) => candidate.id === state.selectedId),
  );
  const apply = useEditor((state) => state.apply);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selectedAssignmentId ? (
        <AssignmentPanel key={selectedAssignmentId} />
      ) : player ? (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-3"
        >
          <h2 className="font-semibold">
            Jugador {player.label}{' '}
            <span className="font-normal text-slate-500">
              ({player.side === 'O' ? 'ataque' : 'defensa'})
            </span>
          </h2>
          <TextField
            label="Etiqueta"
            value={player.label}
            maxLength={4}
            onChange={(event) => {
              const label = event.target.value.slice(0, 4);
              if (label) apply((diagram) => updatePlayer(diagram, player.id, { label }));
            }}
            hint="Hasta 4 letras: X, Z, Mike…"
          />
          <SelectField
            label="Posición"
            value={player.position}
            onChange={(event) =>
              apply((diagram) =>
                updatePlayer(diagram, player.id, { position: event.target.value as Position }),
              )
            }
          >
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Dorsal (opcional)"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={player.number ?? ''}
            onChange={(event) => {
              const value =
                event.target.value === '' ? undefined : Math.trunc(Number(event.target.value));
              if (value === undefined || (value >= 0 && value <= 99)) {
                apply((diagram) => updatePlayer(diagram, player.id, { number: value }));
              }
            }}
          />
          {player.side === 'O' && <BallSection player={player} />}
          <Button
            variant="secondary"
            className="text-red-700"
            onClick={() => apply((diagram) => removePlayer(diagram, player.id))}
          >
            <Trash2 aria-hidden className="size-4" />
            Quitar de la cancha
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-start gap-3 text-sm text-slate-600"
        >
          <MousePointerClick aria-hidden className="size-5 shrink-0 text-turf-700" />
          <p>
            Arrastra a los jugadores para colocarlos y toca uno para cambiar su etiqueta. Para
            dibujar, elige Ruta, Bloqueo o Motion encima de la cancha y arrastra desde el jugador.
            Toca una ruta para cambiar su estilo.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
