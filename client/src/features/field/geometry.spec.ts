import { HASH_OFFSET_YARDS } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { FIELD_WIDTH, fitWindow, fromScreen, hashMarksX, toScreen, yardLines } from './geometry';

describe('geometría de la cancha', () => {
  it('lleva la banda izquierda a x = 0 y la derecha al ancho del campo', () => {
    expect(toScreen({ x: -FIELD_WIDTH / 2, y: 0 }).x).toBeCloseTo(0);
    expect(toScreen({ x: FIELD_WIDTH / 2, y: 0 }).x).toBeCloseTo(FIELD_WIDTH);
  });

  it('dibuja el campo abajo hacia arriba de la pantalla', () => {
    const los = toScreen({ x: 0, y: 0 });
    const downfield = toScreen({ x: 0, y: 10 });
    const backfield = toScreen({ x: 0, y: -5 });
    expect(downfield.y).toBeLessThan(los.y);
    expect(backfield.y).toBeGreaterThan(los.y);
  });

  it('fromScreen deshace toScreen', () => {
    const point = { x: -12.5, y: 7.25 };
    const back = fromScreen(toScreen(point));
    expect(back.x).toBeCloseTo(point.x);
    expect(back.y).toBeCloseTo(point.y);
  });

  it('pone una línea cada 5 yardas dentro de la ventana', () => {
    expect(yardLines({ minY: -12, maxY: 11 })).toEqual([-10, -5, 0, 5, 10]);
  });

  it('separa los hash marks según el reglamento', () => {
    expect(hashMarksX('nfl')).toEqual([-HASH_OFFSET_YARDS.nfl, HASH_OFFSET_YARDS.nfl]);
    const [, college] = hashMarksX('college');
    const [, highSchool] = hashMarksX('high_school');
    expect(highSchool).toBeGreaterThan(college);
  });

  it('encuadra la jugada con un mínimo de campo a cada lado de la LOS', () => {
    expect(fitWindow([])).toEqual({ minY: -10, maxY: 15 });
    expect(
      fitWindow([
        { x: 0, y: -14 },
        { x: 5, y: 30 },
      ]),
    ).toEqual({ minY: -18, maxY: 35 });
  });
});
