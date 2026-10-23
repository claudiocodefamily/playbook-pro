import { afterEach, describe, expect, it } from 'vitest';
import { resolveTheme, setTheme, storedTheme } from './theme';

describe('theme', () => {
  afterEach(() => setTheme('system'));

  it('resuelve "system" según la preferencia del sistema', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('guarda el tema elegido y pone la clase .dark en <html>', () => {
    setTheme('dark');
    expect(storedTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    setTheme('light');
    expect(storedTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('con "system" no guarda nada', () => {
    setTheme('dark');
    setTheme('system');
    expect(localStorage.getItem('playbook-theme')).toBeNull();
    expect(storedTheme()).toBe('system');
  });
});
