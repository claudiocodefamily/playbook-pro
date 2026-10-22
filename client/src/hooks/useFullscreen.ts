import { type RefObject, useCallback, useEffect, useState } from 'react';

/** Pantalla completa de un elemento: para proyectar la jugada en una sesión de coaching. */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setActive(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await ref.current?.requestFullscreen();
    }
  }, [ref]);

  return {
    active,
    toggle,
    supported: typeof document !== 'undefined' && document.fullscreenEnabled,
  };
}
