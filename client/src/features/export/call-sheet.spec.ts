import { describe, expect, it } from 'vitest';
import { buildCallSheetPdf, type CallSheetLayout, layoutCallSheet } from './call-sheet';

const layout: CallSheetLayout = {
  columns: 2,
  top: 0,
  bottom: 100,
  titleHeight: 10,
  emptyHeight: 5,
  gap: 5,
};

describe('layoutCallSheet', () => {
  it('apila las situaciones en la columna mientras caben', () => {
    const blocks = layoutCallSheet([{ playHeights: [10, 10] }, { playHeights: [] }], layout);
    expect(blocks).toEqual([
      { kind: 'title', page: 0, column: 0, y: 0, situation: 0, continued: false },
      { kind: 'play', page: 0, column: 0, y: 10, situation: 0, play: 0 },
      { kind: 'play', page: 0, column: 0, y: 20, situation: 0, play: 1 },
      { kind: 'title', page: 0, column: 0, y: 35, situation: 1, continued: false },
      { kind: 'empty', page: 0, column: 0, y: 45, situation: 1 },
    ]);
  });

  it('sigue en la columna siguiente repitiendo el título, y luego en otra hoja', () => {
    const tall = { playHeights: Array.from({ length: 12 }, () => 10) };
    const blocks = layoutCallSheet([tall, tall], layout);
    const titles = blocks.filter((block) => block.kind === 'title');
    expect(titles.map(({ page, column, continued }) => ({ page, column, continued }))).toEqual([
      { page: 0, column: 0, continued: false },
      { page: 0, column: 1, continued: true },
      { page: 0, column: 1, continued: false },
      { page: 1, column: 0, continued: true },
    ]);
    // Nada se sale de la columna.
    for (const block of blocks) expect(block.y).toBeLessThan(layout.bottom);
  });

  it('no deja un título solo al final de una columna', () => {
    const blocks = layoutCallSheet([{ playHeights: [85] }, { playHeights: [10] }], layout);
    expect(blocks.at(-2)).toMatchObject({ kind: 'title', column: 1, y: 0 });
  });
});

describe('buildCallSheetPdf', () => {
  it('genera un PDF', async () => {
    const blob = await buildCallSheetPdf({
      teamName: 'Lobos',
      opponent: 'Halcones',
      dateText: 'sáb, 7 nov 2026',
      situations: [
        { name: '1st & 10', plays: [{ name: 'Mesh Right' }, { name: 'Inside Zone' }] },
        { name: 'Red zone', plays: [] },
      ],
    });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
