import type { PlayDiagram } from '@playbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { playsApi } from '../../lib/api/endpoints';
import { queries } from '../../lib/api/queries';
import type { Concept, Playbook } from '../../lib/api/types';
import { SIDE_LABELS } from '../../lib/labels';
import type { ExportPlay, ExportSource } from './ExportDialog';

/** Cuántas jugadas se piden a la vez al exportar un playbook entero. */
const PARALLEL = 4;

function conceptsOf(conceptIds: readonly string[], concepts: readonly Concept[]) {
  return conceptIds.flatMap((id) => {
    const concept = concepts.find((candidate) => candidate.id === id);
    return concept ? [{ name: concept.name, explanation: concept.explanation }] : [];
  });
}

/** Prepara lo que se exporta: los datos del equipo y del glosario salen de la caché. */
export function useExportSources(teamId: string) {
  const client = useQueryClient();
  const common = async () => {
    const [team, concepts] = await Promise.all([
      client.fetchQuery(queries.team(teamId)),
      client.fetchQuery(queries.concepts(teamId)),
    ]);
    return { team, concepts };
  };

  return {
    /** Una jugada tal como está en pantalla (en el editor, con los cambios sin guardar). */
    play: async (play: {
      name: string;
      tags: readonly string[];
      conceptIds: readonly string[];
      diagram: PlayDiagram;
      playbook: Pick<Playbook, 'side'> | null;
    }): Promise<ExportSource> => {
      const { team, concepts } = await common();
      return {
        teamName: team.name,
        ruleset: team.ruleset,
        title: play.name,
        subtitle: play.playbook ? SIDE_LABELS[play.playbook.side] : '',
        plays: [
          {
            name: play.name,
            tags: play.tags,
            diagram: play.diagram,
            concepts: conceptsOf(play.conceptIds, concepts),
          },
        ],
      };
    },

    /** Todas las jugadas del playbook, en el mismo orden que la lista. */
    playbook: async (playbook: Playbook): Promise<ExportSource> => {
      const [{ team, concepts }, summaries] = await Promise.all([
        common(),
        playsApi.list(teamId, playbook.id),
      ]);
      const plays: ExportPlay[] = [];
      for (let start = 0; start < summaries.length; start += PARALLEL) {
        const batch = await Promise.all(
          summaries
            .slice(start, start + PARALLEL)
            .map((summary) => playsApi.get(teamId, summary.id)),
        );
        for (const play of batch) {
          plays.push({
            name: play.name,
            tags: play.tags,
            diagram: play.diagram,
            concepts: conceptsOf(play.conceptIds, concepts),
          });
        }
      }
      const count = plays.length === 1 ? '1 jugada' : `${plays.length} jugadas`;
      return {
        teamName: team.name,
        ruleset: team.ruleset,
        title: playbook.name,
        subtitle: `${SIDE_LABELS[playbook.side]} · ${count}`,
        plays,
      };
    },
  };
}
