import { toMongoUpdate, withoutNullish } from './mongo-update.js';

describe('withoutNullish', () => {
  it('quita undefined y null, y conserva false y 0', () => {
    expect(withoutNullish({ a: 1, b: undefined, c: null, d: false, e: 0 })).toEqual({
      a: 1,
      d: false,
      e: 0,
    });
  });
});

describe('toMongoUpdate', () => {
  it('guarda los valores, borra los null e ignora los undefined', () => {
    expect(toMongoUpdate({ name: 'Lobos', logoUrl: null, ruleset: undefined })).toEqual({
      $set: { name: 'Lobos' },
      $unset: { logoUrl: 1 },
    });
  });

  it('no genera operadores vacíos', () => {
    expect(toMongoUpdate({ name: undefined })).toEqual({});
  });
});
