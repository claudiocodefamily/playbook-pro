import {
  FIELD_HALF_WIDTH_YARDS,
  HASH_OFFSET_YARDS,
  type PlayDiagram,
  type Point,
  type Ruleset,
} from '@playbook/shared';

/**
 * Zona del campo que se dibuja, en yardas del diagram (y = 0 es la LOS).
 * Por defecto: 15 yardas de backfield ofensivo y 25 campo abajo, el ancho completo.
 */
export interface FieldWindow {
  minY: number;
  maxY: number;
}

export const DEFAULT_WINDOW: FieldWindow = { minY: -15, maxY: 25 };

export const FIELD_WIDTH = FIELD_HALF_WIDTH_YARDS * 2;

/**
 * Convierte coordenadas del diagram a las de la pantalla (SVG o Konva) en unidades de yarda:
 * x empieza en la banda izquierda y la y de pantalla crece hacia abajo, así que el campo
 * abajo (y positiva del diagram) queda arriba y la ofensiva mira hacia arriba.
 */
export function toScreen(point: Point, window: FieldWindow = DEFAULT_WINDOW): Point {
  return { x: point.x + FIELD_HALF_WIDTH_YARDS, y: window.maxY - point.y };
}

/** Operación inversa de `toScreen`, para cuando el coach toca o arrastra en la cancha. */
export function fromScreen(point: Point, window: FieldWindow = DEFAULT_WINDOW): Point {
  return { x: point.x - FIELD_HALF_WIDTH_YARDS, y: window.maxY - point.y };
}

/** Líneas de yarda (cada 5) dentro de la ventana, relativas a la LOS. */
export function yardLines(window: FieldWindow = DEFAULT_WINDOW): number[] {
  const lines: number[] = [];
  for (let y = Math.ceil(window.minY / 5) * 5; y <= window.maxY; y += 5) {
    lines.push(y);
  }
  return lines;
}

/** Posición x (en el diagram) de los dos hash marks según el reglamento. */
export function hashMarksX(ruleset: Ruleset): [number, number] {
  const offset = HASH_OFFSET_YARDS[ruleset];
  return [-offset, offset];
}

/**
 * Ventana que encuadra a todos los jugadores y rutas con margen, sin bajar de
 * 10 yardas de backfield ni de 15 campo abajo. Así una jugada corta no se ve diminuta.
 */
export function fitWindow(points: readonly Point[]): FieldWindow {
  const ys = points.map((point) => point.y);
  return {
    minY: Math.floor(Math.min(-10, ...ys.map((y) => y - 4))),
    maxY: Math.ceil(Math.max(15, ...ys.map((y) => y + 5))),
  };
}

/**
 * Ventana con la que se abre una jugada: todo lo dibujado (jugadores, rutas, el fondo de
 * cada zona y los rayones) con al menos 12 yardas de backfield y 18 campo abajo.
 */
export function diagramWindow(diagram: PlayDiagram): FieldWindow {
  const fit = fitWindow([
    ...diagram.players,
    ...diagram.assignments.flatMap((a) => a.points),
    ...diagram.drawings.flatMap((drawing) => drawing.points),
    // El borde profundo de cada zona (fitWindow ya añade 5 yardas de margen).
    ...diagram.assignments.flatMap((a) =>
      a.type === 'zone' && a.points[0]
        ? [{ x: a.points[0].x, y: a.points[0].y + a.zone.depth / 2 - 4 }]
        : [],
    ),
  ]);
  return { minY: Math.min(-12, fit.minY), maxY: Math.max(18, fit.maxY) };
}

/**
 * Hasta dónde llega campo abajo lo que no se ve en las rutas: un rival puesto campo abajo
 * (un punt return) o el destino de una patada.
 */
export function diagramReach(diagram: PlayDiagram): number {
  return Math.max(
    ...diagram.players.map((player) => player.y + 5),
    ...diagram.ball.carrierTimeline.map((entry) => (entry.target?.y ?? 0) + 3),
  );
}

/** Ventana para mirar una jugada que no cambia (visor, exportar): todo cabe, también campo abajo. */
export function viewWindow(diagram: PlayDiagram): FieldWindow {
  const base = diagramWindow(diagram);
  return { ...base, maxY: Math.max(base.maxY, diagramReach(diagram)) };
}
