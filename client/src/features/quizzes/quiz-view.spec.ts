import { createEmptyDiagram, newId } from '@playbook/shared';
import { describe, expect, it } from 'vitest';
import {
  optionDiagram,
  optionLetter,
  questionWindow,
  scoreText,
  type AssignmentQuestionView,
} from './quiz-view';

function question(): AssignmentQuestionView {
  const x = { id: newId(), side: 'O', position: 'WR', label: 'X', x: -20, y: 0 } as const;
  const route = (y: number) => ({
    id: newId(),
    playerId: x.id,
    type: 'route' as const,
    points: [{ x: -20, y }],
    style: { line: 'solid' as const, end: 'arrow' as const, curved: false },
    startTime: 0,
    endTime: 2,
  });
  return {
    id: newId(),
    kind: 'assignment',
    prompt: '¿Qué hace X?',
    playId: newId(),
    playName: 'Go',
    playerId: x.id,
    diagram: { ...createEmptyDiagram(), players: [x] },
    options: [
      { id: newId(), assignments: [route(5)] },
      { id: newId(), assignments: [route(40)] },
    ],
  };
}

describe('quiz-view', () => {
  it('pone la tarea de la opción en la jugada', () => {
    const q = question();
    const second = q.options[1];
    if (!second) throw new Error('falta la opción');

    expect(optionDiagram(q, second.id).assignments).toEqual(second.assignments);
    expect(optionDiagram(q, 'otra').assignments).toEqual([]);
  });

  it('encuadra todas las opciones, también la más profunda', () => {
    expect(questionWindow(question()).maxY).toBeGreaterThanOrEqual(40);
  });

  it('letras y notas', () => {
    expect([0, 1, 2, 3].map(optionLetter)).toEqual(['A', 'B', 'C', 'D']);
    expect(scoreText({ correct: 3, total: 4 })).toBe('3 de 4');
    expect(scoreText(null)).toBeNull();
  });
});
