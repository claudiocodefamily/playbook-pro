import { useState } from 'react';
import { cn } from '../../lib/cn';

/** Foto del jugador o, si no tiene (o no carga), su dorsal sobre el verde del equipo. */
export function PlayerAvatar({
  name,
  number,
  photoUrl,
  className,
}: {
  name: string;
  number: number;
  photoUrl?: string | undefined;
  className?: string;
}) {
  // La URL que falló al cargar: si cambia la foto, se vuelve a intentar.
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = photoUrl !== undefined && photoUrl !== failed;
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-turf-700 font-bold text-white',
        className,
      )}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(photoUrl)}
        />
      ) : (
        <span aria-hidden>{number}</span>
      )}
    </span>
  );
}
