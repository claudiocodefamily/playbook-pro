import type { RenderedPlay } from './PlayImage';

export interface PdfPlay {
  name: string;
  tags: readonly string[];
  notes: string;
  concepts: readonly { name: string; explanation: string }[];
  image: RenderedPlay;
}

export interface PdfPlaybook {
  teamName: string;
  /** Nombre del playbook, o de la jugada si se exporta una sola. */
  title: string;
  subtitle: string;
  plays: readonly PdfPlay[];
}

// A4 vertical, en milímetros.
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** La cancha nunca ocupa más de esto de alto, para que quepan las notas debajo. */
const MAX_IMAGE_HEIGHT = 170;
const TURF = [31, 77, 40] as const;
const MUTED = [100, 116, 139] as const;
const INK = [15, 23, 42] as const;

/**
 * PDF para imprimir o mandar: una portada con el índice y una página por jugada con la
 * cancha, los conceptos y las notas. Se genera en el navegador; jsPDF se carga solo al
 * exportar para no hacer más pesada la app.
 */
export async function buildPlaybookPdf(playbook: PdfPlaybook): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const footer = `${playbook.teamName} · ${playbook.title}`;
  const color = (rgb: readonly [number, number, number]) =>
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  // Portada con el índice (solo si hay más de una jugada).
  if (playbook.plays.length > 1) {
    doc.setFillColor(TURF[0], TURF[1], TURF[2]);
    doc.rect(0, 0, PAGE_WIDTH, 70, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(playbook.teamName.toUpperCase(), MARGIN, 25);
    doc.setFontSize(28);
    doc.text(doc.splitTextToSize(playbook.title, CONTENT_WIDTH) as string[], MARGIN, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(playbook.subtitle, MARGIN, 60);

    color(INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Jugadas', MARGIN, 88);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    let y = 98;
    playbook.plays.forEach((play, index) => {
      if (y > PAGE_HEIGHT - MARGIN - 10) {
        doc.addPage();
        y = MARGIN + 5;
      }
      color(INK);
      doc.text(`${index + 1}. ${play.name}`, MARGIN, y);
      y += 7;
    });
  }

  playbook.plays.forEach((play, index) => {
    if (index > 0 || playbook.plays.length > 1) doc.addPage();
    let y = MARGIN + 5;

    color(INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(play.name, MARGIN, y);
    y += 6;
    if (play.tags.length > 0) {
      color(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(play.tags.map((tag) => `#${tag}`).join('  '), MARGIN, y);
      y += 5;
    }
    y += 2;

    // La cancha a todo el ancho, o más estrecha si es muy alta (un punt return).
    let width = CONTENT_WIDTH;
    let height = width / play.image.aspect;
    if (height > MAX_IMAGE_HEIGHT) {
      height = MAX_IMAGE_HEIGHT;
      width = height * play.image.aspect;
    }
    doc.addImage(play.image.dataUrl, 'PNG', MARGIN + (CONTENT_WIDTH - width) / 2, y, width, height);
    y += height + 8;

    const ensureSpace = (needed: number) => {
      if (y + needed > PAGE_HEIGHT - MARGIN - 8) {
        doc.addPage();
        y = MARGIN + 5;
      }
    };
    const heading = (text: string) => {
      ensureSpace(12);
      color(TURF);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(text.toUpperCase(), MARGIN, y);
      y += 6;
    };
    const paragraph = (text: string, bold = false) => {
      color(INK);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(11);
      for (const line of doc.splitTextToSize(text, CONTENT_WIDTH) as string[]) {
        ensureSpace(5);
        doc.text(line, MARGIN, y);
        y += 5;
      }
    };

    if (play.concepts.length > 0) {
      heading('Conceptos');
      for (const concept of play.concepts) {
        paragraph(concept.name, true);
        paragraph(concept.explanation);
        y += 2;
      }
      y += 2;
    }
    if (play.notes.trim()) {
      heading('Notas');
      paragraph(play.notes.trim());
    }
  });

  // Pie en todas las páginas.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    color(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(footer, MARGIN, PAGE_HEIGHT - 8);
    doc.text(`${page} / ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
  }

  return doc.output('blob');
}
