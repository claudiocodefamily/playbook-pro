/** Quita las claves sin valor para que Mongoose aplique sus valores por defecto al crear. */
export function withoutNullish(input: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
  );
}

export interface MongoUpdate {
  $set?: Record<string, unknown>;
  $unset?: Record<string, 1>;
}

/**
 * Convierte el DTO de un PATCH en un update de Mongo:
 * `undefined` = no tocar el campo, `null` = borrarlo, cualquier otro valor = guardarlo.
 */
export function toMongoUpdate(input: object): MongoUpdate {
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null) {
      unset[key] = 1;
    } else if (value !== undefined) {
      set[key] = value;
    }
  }
  return {
    ...(Object.keys(set).length > 0 ? { $set: set } : {}),
    ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
  };
}
