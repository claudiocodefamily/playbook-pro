import { z } from 'zod';
import { DIAGRAM_SCHEMA_VERSION, PlayDiagramSchema, type PlayDiagram } from './diagram.schema.js';

type RawDiagram = { schemaVersion: number } & Record<string, unknown>;
type Migration = (input: RawDiagram) => RawDiagram;

/**
 * Migraciones entre versiones del diagram. La clave es la versión de ORIGEN.
 * Ejemplo: `1: (d) => ({ ...d, schemaVersion: 2, nuevoCampo: valorPorDefecto })`.
 */
const migrations: Readonly<Record<number, Migration>> = {
  // v2: patadas (acción "kick", destino `target` y receptor opcional) y campo hasta y = 75.
  // Solo amplía lo que se acepta, así que un diagram v1 ya es un v2 válido.
  1: (d) => ({ ...d, schemaVersion: 2 }),
};

const VersionedSchema = z.looseObject({ schemaVersion: z.number().int().min(1) });

/**
 * Lleva un diagram guardado con cualquier versión anterior a la versión actual
 * y lo valida. Lanza un error si falta una migración o si el resultado no es válido.
 */
export function migrateDiagram(raw: unknown): PlayDiagram {
  let doc: RawDiagram = VersionedSchema.parse(raw);
  if (doc.schemaVersion > DIAGRAM_SCHEMA_VERSION) {
    throw new Error(
      `El diagram es de una versión más nueva (v${doc.schemaVersion}) que la soportada (v${DIAGRAM_SCHEMA_VERSION})`,
    );
  }
  while (doc.schemaVersion < DIAGRAM_SCHEMA_VERSION) {
    const migrate = migrations[doc.schemaVersion];
    if (!migrate) {
      throw new Error(`Falta la migración del diagram desde v${doc.schemaVersion}`);
    }
    doc = migrate(doc);
  }
  return PlayDiagramSchema.parse(doc);
}
