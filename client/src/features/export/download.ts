/** Descarga un archivo generado en el navegador (no pasa por el servidor). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera un poco después: algunos navegadores aún están leyendo el archivo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** "Mesh Right / 2.ª" → "Mesh-Right-2a": un nombre de archivo que vale en cualquier sistema. */
export function safeFilename(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'jugada';
}
