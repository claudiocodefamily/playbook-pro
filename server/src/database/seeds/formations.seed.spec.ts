import {
  createDiagramFromFormation,
  FormationSlotSchema,
  formationSide,
  PlayDiagramSchema,
} from '@playbook/shared';
import { GLOBAL_FORMATIONS } from './formations.seed.js';

describe('GLOBAL_FORMATIONS', () => {
  it('no repite nombre dentro de una unidad', () => {
    const keys = GLOBAL_FORMATIONS.map(({ side, name }) => `${side}/${name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe.each(GLOBAL_FORMATIONS)('$name ($side)', (formation) => {
    it('tiene 11 jugadores con huecos válidos y distintos', () => {
      expect(formation.players).toHaveLength(11);
      for (const slot of formation.players) {
        expect(FormationSlotSchema.safeParse(slot).success).toBe(true);
      }
      const slotIds = formation.players.map((slot) => slot.slotId);
      expect(new Set(slotIds).size).toBe(slotIds.length);
    });

    it('genera un diagram válido', () => {
      const diagram = createDiagramFromFormation(formation.players, formation.side);
      expect(PlayDiagramSchema.safeParse(diagram).success).toBe(true);
    });

    it('coloca a cada unidad en su lado de la LOS', () => {
      // Defensa y equipos que reciben campo abajo (y > 0); ataque y equipos que patean
      // en su backfield (y < 0).
      const direction = formationSide(formation.players, formation.side) === 'D' ? 1 : -1;
      expect(formation.players.every((slot) => Math.sign(slot.y) === direction)).toBe(true);
    });
  });

  it('special teams tiene formaciones para patear y para recibir', () => {
    const special = GLOBAL_FORMATIONS.filter(({ side }) => side === 'special');
    const sides = special.map((formation) => formationSide(formation.players, 'special'));
    expect(sides.filter((side) => side === 'O')).toHaveLength(3);
    expect(sides.filter((side) => side === 'D')).toHaveLength(3);
  });

  it.each(GLOBAL_FORMATIONS.filter(({ side }) => side === 'offense'))(
    '$name tiene 7 jugadores en la LOS',
    (formation) => {
      expect(formation.players.filter((slot) => slot.y === -1)).toHaveLength(7);
    },
  );
});
