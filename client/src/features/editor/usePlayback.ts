import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { ballFlights, fullPlaybackRange } from '../field/ball';
import { adjacentMoment, playMoments } from '../field/moments';
import type { EditorStore } from './editor-store';

export const PLAYBACK_SPEEDS = [1, 0.5] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/**
 * Reproduce la jugada: mueve el reloj desde el primer motion hasta que termina el último
 * trazo. `time` es null cuando no se está mostrando la animación (la cancha muestra la
 * posición inicial y se puede editar).
 */
export function usePlayback(store: EditorStore) {
  const diagram = useStore(store, (state) => state.diagram);
  const range = useMemo(() => fullPlaybackRange(diagram), [diagram]);
  const moments = useMemo(() => playMoments(diagram, ballFlights(diagram)), [diagram]);
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  // Mientras se reproduce, el reloj vive en un ref: cada fotograma suma sobre el anterior
  // sin esperar a que React pinte.
  const timeRef = useRef<number | null>(null);

  // Si la jugada cambia (se editó o se deshizo algo), la animación vuelve al principio.
  const [seenDiagram, setSeenDiagram] = useState(diagram);
  if (seenDiagram !== diagram) {
    setSeenDiagram(diagram);
    setTime(null);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = ((now - last) / 1000) * speed;
      last = now;
      const next = Math.min(range.end, (timeRef.current ?? range.start) + elapsed);
      timeRef.current = next;
      setTime(next);
      if (next >= range.end) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, range]);

  const play = useCallback(() => {
    // Al terminar, volver a darle al play empieza de nuevo.
    const from = time === null || time >= range.end ? range.start : time;
    timeRef.current = from;
    setTime(from);
    setPlaying(true);
  }, [range, time]);

  const pause = useCallback(() => setPlaying(false), []);

  const reset = useCallback(() => {
    setPlaying(false);
    setTime(null);
  }, []);

  const seek = useCallback((t: number) => {
    setPlaying(false);
    timeRef.current = t;
    setTime(t);
  }, []);

  /** Salta al momento clave siguiente o anterior (snap, lanzamiento, recepción...). */
  const step = useCallback(
    (direction: 1 | -1) => {
      const from = time ?? range.start - 1;
      const target = adjacentMoment(moments, from, direction);
      if (target) seek(target.t);
      else if (direction === -1) reset();
    },
    [time, range, moments, seek, reset],
  );

  return {
    time,
    moments,
    step,
    playing,
    speed,
    setSpeed,
    range,
    canPlay: range.end > range.start,
    play,
    pause,
    reset,
    seek,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
