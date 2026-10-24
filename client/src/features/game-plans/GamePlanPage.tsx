import { GAME_PLAN_MAX_SITUATIONS } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { PageSpinner } from '../../components/ui/spinner';
import { useTeamRole } from '../../hooks/useTeamRole';
import { queries, useDeleteGamePlan, useUpdateGamePlan } from '../../lib/api/queries';
import type { GamePlan, GamePlanSituation } from '../../lib/api/types';
import { errorText } from '../../lib/errors';
import { CallSheetButton } from './CallSheetButton';
import { PlayPicker } from './PlayPicker';
import {
  addPlay,
  addSituation,
  formatGameDate,
  movePlay,
  removePlay,
  removeSituation,
  renameSituation,
} from './situations';

/** Un game plan: las situaciones del partido con sus jugadas en orden. */
export function GamePlanPage() {
  const { teamId = '', planId = '' } = useParams();
  const plan = useQuery(queries.gamePlan(teamId, planId));
  const { isCoach } = useTeamRole(teamId);
  const update = useUpdateGamePlan(teamId, planId);
  const deletePlan = useDeleteGamePlan(teamId);
  const navigate = useNavigate();
  const [picking, setPicking] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const situations = plan.data?.situations ?? [];
  const setSituations = (next: GamePlanSituation[]) => update.mutate({ situations: next });
  const published = plan.data?.visibleToPlayers ?? false;
  const pickingSituation = situations.find((situation) => situation.id === picking);

  return (
    <>
      <PageHeader
        title={plan.data ? `vs ${plan.data.opponent}` : 'Game plan'}
        subtitle={
          plan.data && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4" />
              {formatGameDate(plan.data.gameDate) ?? 'Sin fecha'}
            </span>
          )
        }
        back={{ to: `/teams/${teamId}/game-plans`, label: 'Game plans' }}
        actions={
          !isCoach ? (
            <CallSheetButton teamId={teamId} plan={plan.data} />
          ) : (
            <>
              <CallSheetButton teamId={teamId} plan={plan.data} />
              <Button
                variant="secondary"
                aria-pressed={published}
                disabled={!plan.data}
                title="Los jugadores con cuenta solo ven los game plans publicados"
                onClick={() => update.mutate({ visibleToPlayers: !published })}
              >
                {published ? (
                  <Eye aria-hidden className="size-4" />
                ) : (
                  <EyeOff aria-hidden className="size-4" />
                )}
                {published ? 'Publicado' : 'Oculto a jugadores'}
              </Button>
              <Button variant="secondary" disabled={!plan.data} onClick={() => setEditing(true)}>
                <Pencil aria-hidden className="size-4" />
                Editar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Borrar el game plan"
                className="text-slate-400 hover:text-red-600"
                onClick={() => setDeleting(true)}
              >
                <Trash2 aria-hidden className="size-5" />
              </Button>
            </>
          )
        }
      />

      <ErrorAlert message={errorText(update.error)} />
      {plan.isPending ? (
        <PageSpinner />
      ) : plan.isError ? (
        <ErrorAlert message={errorText(plan.error)} />
      ) : (
        <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* El jugador solo ve las situaciones con jugadas. */}
          {situations
            .filter((situation) => isCoach || situation.playIds.length > 0)
            .map((situation) => (
              <li key={situation.id}>
                <SituationCard
                  teamId={teamId}
                  plan={plan.data}
                  situation={situation}
                  editable={isCoach}
                  onRename={(name) =>
                    setSituations(renameSituation(situations, situation.id, name))
                  }
                  onRemove={() => setSituations(removeSituation(situations, situation.id))}
                  onMovePlay={(index, delta) =>
                    setSituations(movePlay(situations, situation.id, index, delta))
                  }
                  onRemovePlay={(playId) =>
                    setSituations(removePlay(situations, situation.id, playId))
                  }
                  onAddPlays={() => setPicking(situation.id)}
                />
              </li>
            ))}
          {isCoach && situations.length < GAME_PLAN_MAX_SITUATIONS && (
            <li>
              <button
                type="button"
                onClick={() => setSituations(addSituation(situations, 'Nueva situación'))}
                className="flex min-h-24 w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 font-semibold text-slate-500 transition hover:border-turf-600 hover:text-turf-700"
              >
                <Plus aria-hidden className="size-5" />
                Añadir situación
              </button>
            </li>
          )}
        </ul>
      )}

      {pickingSituation && (
        <PlayPicker
          teamId={teamId}
          title={`Jugadas para «${pickingSituation.name}»`}
          chosen={pickingSituation.playIds}
          onAdd={(playId) => setSituations(addPlay(situations, pickingSituation.id, playId))}
          onClose={() => setPicking(null)}
        />
      )}
      {plan.data && (
        <EditPlanModal
          plan={plan.data}
          open={editing}
          pending={update.isPending}
          onSave={(input) => update.mutate(input, { onSuccess: () => setEditing(false) })}
          onClose={() => setEditing(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title="¿Borrar el game plan?"
        message={`Se borrará el plan contra ${plan.data?.opponent ?? ''}. Las jugadas no se tocan.`}
        confirmLabel="Borrar"
        pending={deletePlan.isPending}
        onClose={() => setDeleting(false)}
        onConfirm={() =>
          deletePlan.mutate(planId, {
            onSuccess: () => void navigate(`/teams/${teamId}/game-plans`, { replace: true }),
          })
        }
      />
    </>
  );
}

function SituationCard({
  teamId,
  plan,
  situation,
  editable,
  onRename,
  onRemove,
  onMovePlay,
  onRemovePlay,
  onAddPlays,
}: {
  teamId: string;
  plan: GamePlan;
  situation: GamePlanSituation;
  editable: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onMovePlay: (index: number, delta: number) => void;
  onRemovePlay: (playId: string) => void;
  onAddPlays: () => void;
}) {
  const plays = new Map(plan.plays.map((play) => [play.id, play]));
  const [name, setName] = useState(situation.name);
  const [seen, setSeen] = useState(situation.name);
  if (seen !== situation.name) {
    // Cambió desde fuera (otro coach o un error que deshace el cambio).
    setSeen(situation.name);
    setName(situation.name);
  }
  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== situation.name) onRename(trimmed);
    else setName(situation.name);
  };

  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        {editable ? (
          <input
            aria-label="Nombre de la situación"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="min-h-10 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-lg font-semibold hover:bg-slate-50 focus:bg-slate-50 focus:outline-2 focus:outline-turf-600"
          />
        ) : (
          <h2 className="flex-1 text-lg font-semibold">{situation.name}</h2>
        )}
        {editable && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Quitar la situación ${situation.name}`}
            className="shrink-0 text-slate-400 hover:text-red-600"
            onClick={onRemove}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        )}
      </div>

      {situation.playIds.length === 0 ? (
        <p className="text-sm text-slate-500">Sin jugadas todavía.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {situation.playIds.map((playId, index) => {
            const play = plays.get(playId);
            return (
              <li
                key={playId}
                className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-50"
              >
                <span className="w-5 shrink-0 text-right text-sm font-bold text-slate-400">
                  {index + 1}
                </span>
                <Link
                  to={`/teams/${teamId}/plays/${playId}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate font-medium">{play?.name ?? '…'}</span>
                  {play && (
                    <span className="block truncate text-xs text-slate-500">
                      {play.playbookName}
                    </span>
                  )}
                </Link>
                {editable && (
                  <span className="flex shrink-0">
                    <IconButton
                      label={`Subir ${play?.name ?? 'jugada'}`}
                      disabled={index === 0}
                      onClick={() => onMovePlay(index, -1)}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Bajar ${play?.name ?? 'jugada'}`}
                      disabled={index === situation.playIds.length - 1}
                      onClick={() => onMovePlay(index, 1)}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Quitar ${play?.name ?? 'jugada'}`}
                      onClick={() => onRemovePlay(playId)}
                    >
                      <X aria-hidden className="size-4" />
                    </IconButton>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {editable && (
        <Button variant="ghost" className="self-start" onClick={onAddPlays}>
          <Plus aria-hidden className="size-4" />
          Añadir jugadas
        </Button>
      )}
    </section>
  );
}

/** Botón de icono compacto: en una fila de jugada caben tres sin apretar el nombre. */
function IconButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function EditPlanModal({
  plan,
  open,
  pending,
  onSave,
  onClose,
}: {
  plan: GamePlan;
  open: boolean;
  pending: boolean;
  onSave: (input: { opponent: string; gameDate: string | null }) => void;
  onClose: () => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const gameDate = String(form.get('gameDate'));
    onSave({ opponent: String(form.get('opponent')).trim(), gameDate: gameDate || null });
  };
  return (
    <Modal open={open} title="Editar game plan" onClose={onClose}>
      <form key={plan.updatedAt} onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Rival"
          name="opponent"
          required
          maxLength={80}
          defaultValue={plan.opponent}
        />
        <TextField
          label="Día del partido (opcional)"
          name="gameDate"
          type="date"
          defaultValue={plan.gameDate ?? ''}
        />
        <Button type="submit" size="lg" loading={pending}>
          Guardar
        </Button>
      </form>
    </Modal>
  );
}
