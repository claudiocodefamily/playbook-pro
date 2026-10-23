import { describe, expect, it } from 'vitest';
import { buildPlaybookPdf, type PdfPlay } from './pdf';

// PNG de 1×1 píxel.
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const play = (name: string, notes = ''): PdfPlay => ({
  name,
  tags: ['red zone'],
  notes,
  concepts: [{ name: 'Mesh', explanation: 'Dos cruces cortos que se rozan.' }],
  image: { dataUrl: PIXEL, aspect: 1.5 },
});

async function pageCount(blob: Blob): Promise<number> {
  const text = await blob.text();
  return (text.match(/\/Type \/Page\b/g) ?? []).length;
}

describe('buildPlaybookPdf', () => {
  it('portada con índice y una página por jugada', async () => {
    const blob = await buildPlaybookPdf({
      teamName: 'Lobos',
      title: 'Ofensiva 2026',
      subtitle: 'Ofensiva · 2 jugadas',
      plays: [play('Mesh Right', 'Lee al Mike.'), play('Slant')],
    });
    expect(blob.type).toBe('application/pdf');
    expect(await pageCount(blob)).toBe(3);
  });

  it('una sola jugada no lleva portada', async () => {
    const blob = await buildPlaybookPdf({
      teamName: 'Lobos',
      title: 'Mesh Right',
      subtitle: 'Ofensiva',
      plays: [play('Mesh Right')],
    });
    expect(await pageCount(blob)).toBe(1);
  });

  it('las notas largas siguen en otra página', async () => {
    const blob = await buildPlaybookPdf({
      teamName: 'Lobos',
      title: 'Mesh Right',
      subtitle: 'Ofensiva',
      plays: [play('Mesh Right', 'Coaching point muy largo. '.repeat(400))],
    });
    expect(await pageCount(blob)).toBeGreaterThan(1);
  });
});
