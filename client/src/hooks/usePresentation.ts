import { type RefObject, useCallback, useEffect, useState } from 'react';

/**
 * Modo presentación de un elemento: lo pone a pantalla completa para proyectar la jugada
 * en una sesión. Donde el navegador no deja (Safari en iPhone), ocupa toda la ventana.
 */
export function usePresentation(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);

  // Si se sale de la pantalla completa con la tecla Esc del navegador, se sale del modo.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enter = useCallback(async () => {
    setActive(true);
    if (document.fullscreenEnabled && ref.current) {
      // Si el navegador lo rechaza, queda el modo a ventana completa.
      await ref.current.requestFullscreen().catch(() => undefined);
    }
  }, [ref]);

  const exit = useCallback(async () => {
    setActive(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  }, []);

  return { active, enter, exit, toggle: active ? exit : enter };
}
