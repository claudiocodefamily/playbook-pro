import { createEmptyDiagram, newId, type PlayDiagram } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import { adjacentMoment, momentAt, playMoments } from './moments';

const C = newId();
const QB = newId();
const X = newId();

/** El X hace motion, corre su ruta y el QB le lanza. */
function play(): PlayDiagram {
  const style = { line: 'solid', end: 'arrow', curved: false } as const;
  return {
    ...createEmptyDiagram(),
    players: [
      { id: C, side: 'O', position: 'OL', label: 'C', x: 0, y: -1 },
      { id: QB, side: 'O', position: 'QB', label: 'QB', x: 0, y: -5 },
      { id: X, side: 'O', position: 'WR', label: 'X', x: -10, y: -1 },
    ],
    assignments: [
      {
        id: newId(),
        playerId: X,
        type: 'motion',
        points: [{ x: -6, y: -1 }],
        style,
        startTime: -1.5,
        endTime: 0,
      },
      {
        id: newId(),
        playerId: X,
        type: 'route',
        points: [{ x: -6, y: 9 }],
        style,
        startTime: 0,
        endTime: 2,
      },
    ],
    ball: {
      carrierTimeline: [
        { t: 0, playerId: QB, action: 'snap' },
        { t: 1.4, playerId: X, action: 'pass' },
      ],
    },
  };
}

describe('playMoments', () => {
  it('lista motion, snap, lanzamiento, recepción y final en orden y sin repetir el snap', () => {
    const labels = playMoments(play()).map((moment) => moment.label);
    expect(labels).toEqual(['Motion', 'Snap', 'Lanzamiento', 'Recepción', 'Final']);
  });

  it('incluye los momentos que marcó el coach', () => {
    const diagram = play();
    const withKeyframe = {
      ...diagram,
      timeline: { ...diagram.timeline, keyframes: [{ t: 0.8, label: 'Lectura del safety' }] },
    };
    expect(playMoments(withKeyframe).map((moment) => moment.label)).toContain('Lectura del safety');
  });
});

describe('adjacentMoment y momentAt', () => {
  it('salta al siguiente y al anterior y reconoce el momento actual', () => {
    const moments = playMoments(play());
    expect(adjacentMoment(moments, -5, 1)?.label).toBe('Motion');
    expect(adjacentMoment(moments, 0, 1)?.label).toBe('Lanzamiento');
    expect(adjacentMoment(moments, 1.4, -1)?.label).toBe('Snap');
    expect(adjacentMoment(moments, -1.5, -1)).toBeNull();
    expect(momentAt(moments, 1.42)?.label).toBe('Lanzamiento');
    expect(momentAt(moments, 0.7)).toBeNull();
  });
});
