import { POSITIONS, type Position } from '@playbook/shared';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorAlert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/field';
import { Modal } from '../../components/ui/modal';
import { ApiError } from '../../lib/api/client';
import { uploadsApi, uploadToCloudinary } from '../../lib/api/endpoints';
import { useDeleteRosterPlayer, useSaveRosterPlayer } from '../../lib/api/queries';
import type { RosterPlayer } from '../../lib/api/types';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/errors';
import { PlayerAvatar } from './PlayerAvatar';

interface RosterPlayerModalProps {
  teamId: string;
  /** null para un jugador nuevo. */
  player: RosterPlayer | null;
  open: boolean;
  /** Dorsales de los demás jugadores activos, para avisar si se repite. */
  takenNumbers: readonly number[];
  onClose: () => void;
}

export function RosterPlayerModal(props: RosterPlayerModalProps) {
  return (
    <Modal
      open={props.open}
      title={props.player ? 'Editar jugador' : 'Nuevo jugador'}
      onClose={props.onClose}
    >
      {/* key: el formulario empieza de cero con cada jugador. */}
      <RosterPlayerForm key={props.player?.id ?? 'new'} {...props} />
    </Modal>
  );
}

function RosterPlayerForm({ teamId, player, takenNumbers, onClose }: RosterPlayerModalProps) {
  const save = useSaveRosterPlayer(teamId);
  const remove = useDeleteRosterPlayer(teamId);
  const [name, setName] = useState(player?.name ?? '');
  const [number, setNumber] = useState(player ? String(player.number) : '');
  const [positions, setPositions] = useState<Position[]>(player?.positions ?? []);
  const [photoUrl, setPhotoUrl] = useState(player?.photoUrl ?? '');
  const [active, setActive] = useState(player?.active ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const numberValue = Number(number);
  const repeated = number !== '' && active && takenNumbers.includes(numberValue);

  const togglePosition = (position: Position) =>
    setPositions((current) =>
      current.includes(position)
        ? current.filter((candidate) => candidate !== position)
        : [...current, position],
    );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(
      {
        id: player?.id ?? null,
        input: {
          name: name.trim(),
          number: numberValue,
          positions,
          // Al editar, null quita la foto; al crear, sin foto no se envía.
          photoUrl: photoUrl.trim() || (player ? null : undefined),
          active,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <PhotoField
          teamId={teamId}
          name={name || 'Jugador'}
          number={number === '' ? 0 : numberValue}
          value={photoUrl}
          onChange={setPhotoUrl}
        />
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <TextField
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            autoFocus={!player}
          />
          <TextField
            label="Dorsal"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            required
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
        </div>
        {repeated && (
          <p className="-mt-2 text-sm text-amber-700 dark:text-amber-400">
            Otro jugador activo ya lleva el {numberValue}.
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Posiciones</legend>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map((position) => {
              const selected = positions.includes(position);
              return (
                <button
                  key={position}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => togglePosition(position)}
                  className={cn(
                    'min-h-10 min-w-12 rounded-xl px-3 text-sm font-semibold ring-1 transition-colors active:scale-95',
                    selected
                      ? 'bg-turf-700 text-white ring-turf-700'
                      : 'bg-surface text-slate-700 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  {position}
                </button>
              );
            })}
          </div>
        </fieldset>

        {player && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="size-5 accent-turf-700"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Sigue en el equipo (desmárcalo si se fue: no se borra, queda en "Inactivos")
          </label>
        )}

        <ErrorAlert message={errorText(save.error)} />
        <div className="flex gap-2">
          {player && (
            <Button
              variant="secondary"
              className="text-red-700 dark:text-red-300"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden className="size-4" />
              Borrar
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={save.isPending}>
            {player ? 'Guardar' : 'Añadir al roster'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Borrar al jugador?"
        message={`${player?.name ?? ''} desaparecerá del roster. Si solo dejó el equipo, mejor márcalo como inactivo.`}
        confirmLabel="Borrar"
        pending={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          player &&
          remove.mutate(player.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />
    </>
  );
}

/**
 * Foto del jugador: se sube directamente a Cloudinary con una firma de la API. Si la API
 * no tiene Cloudinary configurado, se puede pegar la URL de una foto.
 */
function PhotoField({
  teamId,
  name,
  number,
  value,
  onChange,
}: {
  teamId: string;
  name: string;
  number: number;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const signature = await uploadsApi.rosterPhotoSignature(teamId);
      onChange(await uploadToCloudinary(file, signature));
    } catch (caught) {
      // La API explica por qué no firma (p. ej. sin Cloudinary); si falla Cloudinary, lo decimos.
      setError(
        caught instanceof ApiError || caught instanceof TypeError
          ? errorText(caught)
          : 'No se pudo subir la foto. Prueba con otra imagen o pega su URL.',
      );
      setShowUrl(true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <PlayerAvatar
          name={name}
          number={number}
          photoUrl={value || undefined}
          className="size-20 text-3xl"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={uploading} onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden className="size-4" />
            {value ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {value && (
            <Button variant="ghost" onClick={() => onChange('')}>
              <X aria-hidden className="size-4" />
              Quitar
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
      <ErrorAlert message={error} />
      {showUrl ? (
        <TextField
          label="URL de la foto"
          type="url"
          placeholder="https://…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          hint="Debe empezar por https://"
        />
      ) : (
        <button
          type="button"
          className="self-start text-xs font-medium text-turf-700 underline dark:text-turf-300"
          onClick={() => setShowUrl(true)}
        >
          O pega la URL de una foto
        </button>
      )}
    </div>
  );
}
