import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { momentAt } from '../field/moments';
import { PLAYBACK_SPEEDS, type Playback } from './usePlayback';

/** Controles de la animación: reproducir, pausar, mover el reloj a mano y velocidad. */
export function PlaybackBar({ playback }: { playback: Playback }) {
  const { time, playing, range, speed, canPlay } = playback;
  const current = time ?? range.start;
  const moment = time === null ? null : momentAt(playback.moments, time);

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-black/25 p-1.5 text-white">
      <Button
        size="icon"
        variant="ghost"
        className="text-white hover:bg-white/10"
        disabled={!canPlay}
        aria-label="Momento anterior"
        title="Momento anterior (←)"
        onClick={() => playback.step(-1)}
      >
        <SkipBack aria-hidden className="size-5" />
      </Button>
      <Button
        size="icon"
        variant="secondary"
        disabled={!canPlay}
        aria-label={playing ? 'Pausar' : 'Reproducir la jugada'}
        title={canPlay ? undefined : 'Dibuja alguna ruta para poder animar la jugada'}
        onClick={playing ? playback.pause : playback.play}
      >
        {playing ? (
          <Pause aria-hidden className="size-5" />
        ) : (
          <Play aria-hidden className="size-5 fill-current" />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="text-white hover:bg-white/10"
        disabled={!canPlay}
        aria-label="Momento siguiente"
        title="Momento siguiente (→)"
        onClick={() => playback.step(1)}
      >
        <SkipForward aria-hidden className="size-5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="hidden text-white hover:bg-white/10 sm:inline-flex"
        disabled={time === null}
        aria-label="Volver a la posición inicial"
        title="Volver a la posición inicial"
        onClick={playback.reset}
      >
        <RotateCcw aria-hidden className="size-5" />
      </Button>
      <input
        type="range"
        aria-label="Momento de la jugada"
        className="h-11 min-w-0 flex-1 accent-white"
        min={range.start}
        max={range.end}
        step={0.05}
        value={current}
        disabled={!canPlay}
        onChange={(event) => playback.seek(Number(event.target.value))}
      />
      <span
        className="min-w-14 text-right text-sm leading-tight font-semibold tabular-nums"
        aria-live="polite"
      >
        {moment && moment.label !== 'Snap' && (
          <span className="block text-xs text-amber-300">{moment.label}</span>
        )}
        {formatTime(current)}
      </span>
      <div className="flex rounded-xl bg-white/10 p-0.5" role="group" aria-label="Velocidad">
        {PLAYBACK_SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={speed === option}
            onClick={() => playback.setSpeed(option)}
            className={cn(
              'min-h-10 rounded-lg px-2.5 text-sm font-semibold',
              speed === option ? 'bg-white text-turf-900' : 'text-white/80',
            )}
          >
            {option === 1 ? '1x' : '½x'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "-1.5 s" antes del snap, "Snap" justo en él y "2.0 s" después. */
function formatTime(t: number): string {
  if (Math.abs(t) < 0.05) return 'Snap';
  return `${t > 0 ? '+' : ''}${t.toFixed(1)} s`;
}
