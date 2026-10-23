import type { PlayDiagram } from '@playbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { ApiError } from '../../lib/api/client';
import { playsApi } from '../../lib/api/endpoints';
import { queries } from '../../lib/api/queries';
import type { Play } from '../../lib/api/types';
import type { EditorStore } from './editor-store';

/** Espera tras el último cambio antes de guardar: agrupa varios movimientos en un guardado. */
export const AUTOSAVE_DELAY_MS = 1500;
const ERROR_RETRY_MS = 5000;

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

/**
 * Guarda solo los cambios del editor. Usa la `version` de la jugada (bloqueo optimista):
 * si otro coach la guardó mientras tanto, la API responde 409 y se deja de guardar para
 * no pisar su trabajo hasta que el coach recargue.
 */
export function useAutosave(store: EditorStore, play: Play) {
  const queryClient = useQueryClient();
  const dirty = useStore(store, (state) => state.dirty);
  const diagram = useStore(store, (state) => state.diagram);
  const version = useRef(play.version);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);

  /**
   * Guarda lo que hay en pantalla. Con `withVersion` además deja una foto en el historial
   * ("Guardar versión"); con `conceptIds`, cambia los conceptos que enseña la jugada. Van
   * por aquí para compartir la `version` con el autoguardado. Devuelve true si se guardó.
   */
  const save = useCallback(
    async ({
      withVersion = false,
      conceptIds,
    }: { withVersion?: boolean; conceptIds?: string[] } = {}): Promise<boolean> => {
      const plain = !withVersion && conceptIds === undefined;
      if (inFlight.current) {
        // Un autoguardado normal ya en marcha basta; lo demás espera a que termine.
        if (plain) return inFlight.current;
        await inFlight.current;
      }
      const sent: PlayDiagram = store.getState().diagram;
      setStatus('saving');
      inFlight.current = (async () => {
        try {
          const saved = await playsApi.update(play.teamId, play.id, {
            version: version.current,
            diagram: sent,
            ...(withVersion ? { saveVersion: true } : {}),
            ...(conceptIds ? { conceptIds } : {}),
          });
          version.current = saved.version;
          store.getState().markSaved(sent);
          // El resto de la web (listados, vista) ve la jugada al día sin volver a pedirla.
          queryClient.setQueryData(queries.play(play.teamId, play.id).queryKey, {
            ...saved,
            diagram: sent,
          });
          if (withVersion) {
            void queryClient.invalidateQueries({
              queryKey: queries.playVersions(play.teamId, play.id).queryKey,
            });
          }
          setStatus('saved');
          setError(null);
          return true;
        } catch (caught) {
          const conflict = caught instanceof ApiError && caught.status === 409;
          setStatus(conflict ? 'conflict' : 'error');
          setError(
            caught instanceof ApiError ? caught.message : 'No se pudo guardar. Revisa tu conexión.',
          );
          return false;
        } finally {
          inFlight.current = null;
        }
      })();
      return inFlight.current;
    },
    [store, play.teamId, play.id, queryClient],
  );

  useEffect(() => {
    if (!dirty || status === 'conflict' || status === 'saving') return;
    // Tras un error (por ejemplo, sin conexión) se reintenta con más calma.
    const timer = setTimeout(
      () => void save(),
      status === 'error' ? ERROR_RETRY_MS : AUTOSAVE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [dirty, diagram, status, save]);

  // Avisa antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Con cambios por guardar, "guardado" pasa a "sin guardar" sin esperar a otro render.
  return {
    status: status === 'saved' && dirty ? 'pending' : status,
    error,
    saveVersion: () => save({ withVersion: true }),
    saveConcepts: (conceptIds: string[]) => save({ conceptIds }),
  };
}
