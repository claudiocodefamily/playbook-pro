import { describe, expect, it } from 'vitest';
import { newId } from '../ids.js';
import {
  createEmptyDiagram,
  PlayDiagramSchema,
  type DiagramPlayer,
  type PlayDiagram,
} from './diagram.schema.js';
import { migrateDiagram } from './migrations.js';

function player(overrides: Partial<DiagramPlayer> = {}): DiagramPlayer {
  return { id: newId(), side: 'O', position: 'WR', label: 'X', x: -20, y: 0, ...overrides };
}

/** Un slant del X: 1 paso vertical y corte hacia dentro. */
function slantPlay(): PlayDiagram {
  const qb = player({ position: 'QB', label: 'QB', x: 0, y: -5 });
  const x = player();
  return {
    ...createEmptyDiagram(),
    players: [qb, x],
    assignments: [
      {
        id: newId(),
        playerId: x.id,
        type: 'route',
        routeName: 'slant',
        points: [
          { x: -20, y: 1 },
          { x: -14, y: 6 },
        ],
        style: { line: 'solid', end: 'arrow', curved: false },
        startTime: 0,
        endTime: 1.5,
      },
    ],
    ball: {
      carrierTimeline: [
        { t: 0, playerId: qb.id, action: 'snap' },
        { t: 1.5, playerId: x.id, action: 'pass' },
      ],
    },
  };
}

describe('PlayDiagramSchema', () => {
  it('acepta un diagram vacío', () => {
    expect(PlayDiagramSchema.safeParse(createEmptyDiagram()).success).toBe(true);
  });

  it('acepta una jugada con una ruta y pase', () => {
    expect(PlayDiagramSchema.safeParse(slantPlay()).success).toBe(true);
  });

  it('rechaza ids que no son UUIDv7', () => {
    const diagram = { ...createEmptyDiagram(), players: [player({ id: 'jugador-1' })] };
    expect(PlayDiagramSchema.safeParse(diagram).success).toBe(false);
  });

  it('rechaza coordenadas fuera del campo', () => {
    const diagram = { ...createEmptyDiagram(), players: [player({ x: 30 })] };
    expect(PlayDiagramSchema.safeParse(diagram).success).toBe(false);
  });

  it('rechaza más de 11 jugadores en un lado', () => {
    const players = Array.from({ length: 12 }, () => player());
    const result = PlayDiagramSchema.safeParse({ ...createEmptyDiagram(), players });
    expect(result.success).toBe(false);
  });

  it('rechaza ids de jugador duplicados', () => {
    const repeated = player();
    const result = PlayDiagramSchema.safeParse({
      ...createEmptyDiagram(),
      players: [repeated, { ...repeated, label: 'Z' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza una asignación a un jugador inexistente', () => {
    const play = slantPlay();
    const route = play.assignments[0];
    if (!route) throw new Error('falta la ruta');
    const result = PlayDiagramSchema.safeParse({
      ...play,
      assignments: [{ ...route, playerId: newId() }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza una asignación que termina antes de empezar', () => {
    const play = slantPlay();
    const route = play.assignments[0];
    if (!route) throw new Error('falta la ruta');
    const result = PlayDiagramSchema.safeParse({
      ...play,
      assignments: [{ ...route, startTime: 2, endTime: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza una cobertura man sobre un jugador inexistente', () => {
    const cb = player({ side: 'D', position: 'CB', label: 'CB', y: 7 });
    const result = PlayDiagramSchema.safeParse({
      ...createEmptyDiagram(),
      players: [cb],
      assignments: [
        {
          id: newId(),
          playerId: cb.id,
          type: 'man',
          targetPlayerId: newId(),
          style: { line: 'dashed', end: 'none', curved: false },
          startTime: 0,
          endTime: 3,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('acepta una zona con su centro y medidas', () => {
    const safety = player({ side: 'D', position: 'S', label: 'FS', x: 0, y: 12 });
    const result = PlayDiagramSchema.safeParse({
      ...createEmptyDiagram(),
      players: [safety],
      assignments: [
        {
          id: newId(),
          playerId: safety.id,
          type: 'zone',
          points: [{ x: -10, y: 18 }],
          zone: { shape: 'ellipse', width: 20, depth: 10, name: 'deep half' },
          style: { line: 'solid', end: 'none', curved: false },
          startTime: 0,
          endTime: 3,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('patadas (v2)', () => {
  const punter = player({ position: 'P', label: 'P', x: 0, y: -14 });
  const returner = player({ side: 'D', position: 'S', label: 'PR', x: 0, y: 45 });
  const diagramWith = (carrierTimeline: PlayDiagram['ball']['carrierTimeline']) => ({
    ...createEmptyDiagram(),
    players: [punter, returner],
    ball: { carrierTimeline },
  });

  it('acepta un punt al returner y un field goal sin receptor', () => {
    const punt = diagramWith([
      { t: 0, playerId: punter.id, action: 'snap' },
      { t: 2, playerId: returner.id, action: 'kick' },
    ]);
    const fieldGoal = diagramWith([
      { t: 0, playerId: punter.id, action: 'snap' },
      { t: 1.3, action: 'kick', target: { x: 0, y: 30 } },
    ]);
    expect(PlayDiagramSchema.safeParse(punt).success).toBe(true);
    expect(PlayDiagramSchema.safeParse(fieldGoal).success).toBe(true);
  });

  it('rechaza un cambio de manos sin receptor que no sea una patada con destino', () => {
    const noTarget = diagramWith([{ t: 1, action: 'kick' }]);
    const pass = diagramWith([{ t: 1, action: 'pass', target: { x: 0, y: 10 } }]);
    expect(PlayDiagramSchema.safeParse(noTarget).success).toBe(false);
    expect(PlayDiagramSchema.safeParse(pass).success).toBe(false);
  });
});

describe('dibujos (lápiz)', () => {
  const stroke = (points: { x: number; y: number }[]) => ({ id: newId(), color: 'yellow', points });

  it('acepta trazos a mano alzada dentro del campo', () => {
    const play = {
      ...slantPlay(),
      drawings: [
        stroke([
          { x: 0, y: 0 },
          { x: 3, y: 4 },
        ]),
      ],
    };
    expect(PlayDiagramSchema.safeParse(play).success).toBe(true);
  });

  it('rechaza un trazo de un solo punto, un color desconocido o fuera del campo', () => {
    const bad = [
      stroke([{ x: 0, y: 0 }]),
      {
        ...stroke([
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]),
        color: 'green',
      },
      stroke([
        { x: 0, y: 0 },
        { x: 40, y: 1 },
      ]),
    ];
    for (const drawing of bad) {
      expect(PlayDiagramSchema.safeParse({ ...slantPlay(), drawings: [drawing] }).success).toBe(
        false,
      );
    }
  });
});

describe('migrateDiagram', () => {
  it('lleva un diagram v1 a la versión actual sin cambiar su contenido', () => {
    const play = slantPlay();
    const { drawings, ...v1 } = play;
    expect(drawings).toEqual([]);
    expect(migrateDiagram({ ...v1, schemaVersion: 1 })).toEqual(play);
  });

  it('lleva un diagram v2 a la v3 con la lista de dibujos vacía', () => {
    const { drawings, ...v2 } = slantPlay();
    const migrated = migrateDiagram({ ...v2, schemaVersion: 2 });
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.drawings).toEqual(drawings);
  });

  it('devuelve tal cual un diagram de la versión actual', () => {
    const play = slantPlay();
    expect(migrateDiagram(play)).toEqual(play);
  });

  it('rechaza un diagram de una versión futura', () => {
    expect(() => migrateDiagram({ ...createEmptyDiagram(), schemaVersion: 99 })).toThrow(
      /versión más nueva/,
    );
  });

  it('rechaza datos sin schemaVersion', () => {
    expect(() => migrateDiagram({ players: [] })).toThrow(/schemaVersion/);
  });
});
