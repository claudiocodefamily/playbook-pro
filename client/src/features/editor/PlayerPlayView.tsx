import type { Ruleset } from '@playbook/shared';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/PageHeader';
import { PageSpinner } from '../../components/ui/spinner';
import { queries } from '../../lib/api/queries';
import type { Play } from '../../lib/api/types';
import { ExportPlayButton } from '../export/ExportButtons';
import { PlayViewer } from '../shared/PlayViewer';
import { focusForPositions } from './focus';

/**
 * Lo que ve un jugador con cuenta al abrir una jugada: la animación sin herramientas de
 * edición, con el modo jugador ya puesto en su posición.
 */
export function PlayerPlayView({ play, ruleset }: { play: Play; ruleset: Ruleset }) {
  const me = useQuery(queries.me(play.teamId));
  const concepts = useQuery(queries.concepts(play.teamId));
  const linked = play.conceptIds.flatMap((id) => {
    const concept = concepts.data?.find((candidate) => candidate.id === id);
    return concept ? [concept] : [];
  });
  const rosterPlayer = me.data?.rosterPlayer ?? null;

  return (
    <>
      <PageHeader
        title={play.name}
        subtitle={
          rosterPlayer && (
            <span className="text-sm text-slate-500">
              Resaltado: tu posición (#{rosterPlayer.number} {rosterPlayer.name})
            </span>
          )
        }
        back={{ to: `/teams/${play.teamId}/playbooks/${play.playbookId}`, label: 'Jugadas' }}
        actions={
          <ExportPlayButton
            teamId={play.teamId}
            name={play.name}
            tags={play.tags}
            conceptIds={play.conceptIds}
            side={null}
            getDiagram={() => play.diagram}
          />
        }
      />
      {me.isPending ? (
        <PageSpinner />
      ) : (
        <PlayViewer
          diagram={play.diagram}
          ruleset={ruleset}
          concepts={linked}
          initialFocus={focusForPositions(play.diagram, rosterPlayer?.positions ?? [])}
        />
      )}
    </>
  );
}
