import type { RenderedPlay } from './PlayImage';

export interface CallSheetPlay {
  name: string;
  /** Miniatura de la cancha, si se pidió. */
  image?: RenderedPlay;
}

export interface CallSheet {
  teamName: string;
  opponent: string;
  /** "sáb, 7 nov 2026", o vacío si no hay fecha. */
  dateText: string;
  situations: readonly { name: string; plays: readonly CallSheetPlay[] }[];
}

/** Un trozo del call sheet ya colocado en la hoja, en milímetros. */
export type PlacedBlock =
  | {
      kind: 'title';
      page: number;
      column: number;
      y: number;
      situation: number;
      continued: boolean;
    }
  | { kind: 'play'; page: number; column: number; y: number; situation: number; play: number }
  | { kind: 'empty'; page: number; column: number; y: number; situation: number };

export interface CallSheetLayout {
  columns: number;
  /** Dónde empieza y acaba el contenido de cada columna. */
  top: number;
  bottom: number;
  titleHeight: number;
  emptyHeight: number;
  /** Separación entre situaciones. */
  gap: number;
}

/**
 * Reparte las situaciones en columnas, de arriba abajo y de izquierda a derecha, como una
 * call sheet de banda. Si una situación no cabe entera, sigue en la columna siguiente
 * repitiendo su título ("sigue"); si no quedan columnas, en una hoja nueva.
 */
export function layoutCallSheet(
  situations: readonly { playHeights: readonly number[] }[],
  layout: CallSheetLayout,
): PlacedBlock[] {
  const placed: PlacedBlock[] = [];
  let page = 0;
  let column = 0;
  let y = layout.top;
  const nextColumn = () => {
    column += 1;
    if (column >= layout.columns) {
      column = 0;
      page += 1;
    }
    y = layout.top;
  };
  const fits = (height: number) => y + height <= layout.bottom;

  situations.forEach((situation, index) => {
    if (y > layout.top) y += layout.gap;
    const first = situation.playHeights[0] ?? layout.emptyHeight;
    // El título nunca se queda solo al final de una columna.
    if (!fits(layout.titleHeight + first) && y > layout.top) nextColumn();
    placed.push({ kind: 'title', page, column, y, situation: index, continued: false });
    y += layout.titleHeight;

    if (situation.playHeights.length === 0) {
      placed.push({ kind: 'empty', page, column, y, situation: index });
      y += layout.emptyHeight;
      return;
    }
    situation.playHeights.forEach((height, play) => {
      if (!fits(height)) {
        nextColumn();
        placed.push({ kind: 'title', page, column, y, situation: index, continued: true });
        y += layout.titleHeight;
      }
      placed.push({ kind: 'play', page, column, y, situation: index, play });
      y += height;
    });
  });
  return placed;
}

// A4 horizontal, en milímetros.
const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN = 10;
const COLUMNS = 4;
const COLUMN_GAP = 5;
const COLUMN_WIDTH = (PAGE_WIDTH - MARGIN * 2 - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS;
const HEADER_HEIGHT = 18;
const TITLE_HEIGHT = 8;
const ROW_HEIGHT = 6.5;
const THUMB_MAX_HEIGHT = 30;
const TURF = [31, 77, 40] as const;
const MUTED = [100, 116, 139] as const;
const INK = [15, 23, 42] as const;

function playHeight(play: CallSheetPlay): number {
  if (!play.image) return ROW_HEIGHT;
  const imageHeight = Math.min(THUMB_MAX_HEIGHT, (COLUMN_WIDTH - 6) / play.image.aspect);
  return ROW_HEIGHT + imageHeight + 2;
}

/**
 * La call sheet del partido: A4 horizontal con una columna por situación y sus jugadas
 * numeradas, para llevarla en la banda. jsPDF se carga solo al exportar.
 */
export async function buildCallSheetPdf(sheet: CallSheet): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const color = (rgb: readonly [number, number, number]) =>
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const blocks = layoutCallSheet(
    sheet.situations.map((situation) => ({ playHeights: situation.plays.map(playHeight) })),
    {
      columns: COLUMNS,
      top: MARGIN + HEADER_HEIGHT,
      bottom: PAGE_HEIGHT - MARGIN,
      titleHeight: TITLE_HEIGHT,
      emptyHeight: ROW_HEIGHT,
      gap: 4,
    },
  );
  const pages = Math.max(1, ...blocks.map((block) => block.page + 1));
  const fit = (text: string, width: number) =>
    (doc.splitTextToSize(text, width) as string[])[0] ?? '';

  for (let page = 0; page < pages; page++) {
    if (page > 0) doc.addPage();
    color(INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`vs ${sheet.opponent}`, MARGIN, MARGIN + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    color(MUTED);
    const subtitle = [sheet.teamName, sheet.dateText].filter(Boolean).join(' · ');
    doc.text(subtitle, MARGIN, MARGIN + 13);
    if (pages > 1) {
      doc.text(`${page + 1}/${pages}`, PAGE_WIDTH - MARGIN, MARGIN + 7, { align: 'right' });
    }
  }

  for (const block of blocks) {
    doc.setPage(block.page + 1);
    const x = MARGIN + block.column * (COLUMN_WIDTH + COLUMN_GAP);
    const situation = sheet.situations[block.situation];
    if (!situation) continue;
    if (block.kind === 'title') {
      doc.setFillColor(TURF[0], TURF[1], TURF[2]);
      doc.roundedRect(x, block.y, COLUMN_WIDTH, TITLE_HEIGHT - 1.5, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const title = block.continued ? `${situation.name} (sigue)` : situation.name;
      doc.text(fit(title.toUpperCase(), COLUMN_WIDTH - 4), x + 2, block.y + 4.6);
    } else if (block.kind === 'empty') {
      color(MUTED);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('Sin jugadas', x + 2, block.y + 4.2);
    } else {
      const play = situation.plays[block.play];
      if (!play) continue;
      color(INK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${block.play + 1}.`, x + 1, block.y + 4.4);
      doc.setFont('helvetica', 'normal');
      doc.text(fit(play.name, COLUMN_WIDTH - 9), x + 7, block.y + 4.4);
      if (play.image) {
        const width = Math.min(COLUMN_WIDTH - 6, THUMB_MAX_HEIGHT * play.image.aspect);
        doc.addImage(
          play.image.dataUrl,
          'PNG',
          x + 6,
          block.y + ROW_HEIGHT,
          width,
          width / play.image.aspect,
        );
      } else {
        // Una línea fina entre jugadas, como en una hoja de banda.
        doc.setDrawColor(226, 232, 240);
        doc.line(x + 1, block.y + ROW_HEIGHT - 0.3, x + COLUMN_WIDTH, block.y + ROW_HEIGHT - 0.3);
      }
    }
  }
  return doc.output('blob');
}
