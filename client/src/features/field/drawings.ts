import type { Drawing } from '@playbook/shared';

/** Color de cada tinta del lápiz sobre la hierba, y su nombre para el selector. */
export const DRAWING_INK: Readonly<Record<Drawing['color'], { hex: string; label: string }>> = {
  white: { hex: '#f8fafc', label: 'Blanco' },
  yellow: { hex: '#facc15', label: 'Amarillo' },
  red: { hex: '#ef4444', label: 'Rojo' },
  blue: { hex: '#38bdf8', label: 'Azul' },
};
