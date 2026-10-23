import type { PlayDiagram, PlaybookSide } from '@playbook/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import type { Playbook } from '../../lib/api/types';
import { ExportDialog } from './ExportDialog';
import { useExportSources } from './sources';

/** "Exportar" de una jugada: imagen o PDF de una página. */
export function ExportPlayButton({
  teamId,
  name,
  tags,
  conceptIds,
  side,
  getDiagram,
}: {
  teamId: string;
  name: string;
  tags: readonly string[];
  conceptIds: readonly string[];
  side: PlaybookSide | null;
  /** Se lee al exportar: en el editor, la jugada tal como está en pantalla. */
  getDiagram: () => PlayDiagram;
}) {
  const [open, setOpen] = useState(false);
  const sources = useExportSources(teamId);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} title="Imagen o PDF">
        <Download aria-hidden className="size-4" />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
      <ExportDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Exportar jugada"
        formats={['pdf', 'png']}
        prepare={() =>
          sources.play({
            name,
            tags,
            conceptIds,
            diagram: getDiagram(),
            playbook: side ? { side } : null,
          })
        }
      />
    </>
  );
}

/** "Exportar PDF" de un playbook: portada con índice y una página por jugada. */
export function ExportPlaybookButton({
  teamId,
  playbook,
}: {
  teamId: string;
  playbook: Playbook | undefined;
}) {
  const [open, setOpen] = useState(false);
  const sources = useExportSources(teamId);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={!playbook || playbook.playCount === 0}
        title={playbook?.playCount === 0 ? 'El playbook no tiene jugadas' : 'Descargar en PDF'}
      >
        <Download aria-hidden className="size-4" />
        PDF
      </Button>
      {playbook && (
        <ExportDialog
          open={open}
          onClose={() => setOpen(false)}
          title={`Exportar ${playbook.name}`}
          formats={['pdf']}
          prepare={() => sources.playbook(playbook)}
        />
      )}
    </>
  );
}
