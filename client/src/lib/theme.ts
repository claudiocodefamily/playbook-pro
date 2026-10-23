import { useCallback, useEffect, useSyncExternalStore } from 'react';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Clave en localStorage. index.html la lee antes de pintar para que no haya parpadeo. */
const STORAGE_KEY = 'playbook-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value);
}

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(theme: Theme, systemDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle(
    'dark',
    resolveTheme(theme, systemPrefersDark()) === 'dark',
  );
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento (modo privado): el tema dura lo que la pestaña.
  }
  current = theme;
  applyTheme(theme);
  for (const listener of listeners) listener();
}

let current: Theme | null = null;

function snapshot(): Theme {
  current ??= storedTheme();
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tema elegido y función para cambiarlo. Con "system", sigue los cambios del sistema. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, snapshot);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof matchMedia !== 'function') return;
    const query = matchMedia(DARK_QUERY);
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  return [theme, useCallback((next: Theme) => setTheme(next), [])];
}
