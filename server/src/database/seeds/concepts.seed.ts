import type { PlaybookSide } from '@playbook/shared';

export interface GlobalConceptSeed {
  name: string;
  side: PlaybookSide;
  explanation: string;
}

/**
 * Glosario global: los conceptos más usados, con el nombre en inglés (como se dicen en
 * el campo) y la explicación en español. Cada equipo los ve y puede añadir los suyos.
 */
export const GLOBAL_CONCEPTS: readonly GlobalConceptSeed[] = [
  // Ataque: pase
  {
    name: 'Mesh',
    side: 'offense',
    explanation:
      'Dos receptores cruzan el campo con rutas drag a poca profundidad y se rozan en el centro. El cruce crea un "atasco" que complica el marcaje al hombre. Contra zona, se sientan en los huecos. Suele ir con una ruta corner o un sit por encima.',
  },
  {
    name: 'Smash',
    side: 'offense',
    explanation:
      'Ruta hitch corta del receptor exterior y corner del interior, en el mismo lado. Pone en conflicto al cornerback en Cover 2: si se queda abajo con el hitch, se abre la corner; si retrocede, el hitch queda libre.',
  },
  {
    name: 'Flood',
    side: 'offense',
    explanation:
      'Tres rutas en el mismo lado a tres alturas (flat, out o sail a media altura y go profunda). Sobrecarga una zona con más receptores que defensores. Muy bueno contra Cover 3.',
  },
  {
    name: 'Four Verticals',
    side: 'offense',
    explanation:
      'Cuatro receptores corren rutas profundas (go y seams). Estira la defensa a lo alto y obliga a los safeties a elegir. El QB lee al safety central.',
  },
  {
    name: 'Stick',
    side: 'offense',
    explanation:
      'Pase rápido de tres rutas: el TE o el slot corre un stick (unas 6 yardas y se gira hacia fuera), con un flat por debajo y una go por encima. Lectura sencilla del linebacker exterior.',
  },
  {
    name: 'Slant-Flat',
    side: 'offense',
    explanation:
      'Slant del receptor exterior y flat del interior o del RB. Lectura del defensor de flat: si sigue al flat, el slant entra por dentro; si cierra el slant, el flat queda libre.',
  },
  {
    name: 'Play Action',
    side: 'offense',
    explanation:
      'El QB finge darle el balón al RB antes de pasar. Hace que los linebackers y safeties avancen a parar la carrera y deja espacio detrás de ellos.',
  },
  {
    name: 'Screen',
    side: 'offense',
    explanation:
      'Pase corto detrás de la LOS a un RB o receptor, con linieros que salen a bloquear delante de él. Castiga a una defensa que presiona mucho al QB.',
  },
  // Ataque: carrera
  {
    name: 'Inside Zone',
    side: 'offense',
    explanation:
      'Carrera por dentro en la que toda la línea bloquea hacia el mismo lado por zonas (al hueco, no a un jugador fijo). El RB lee los bloqueos y elige el hueco: puede cortar hacia atrás (cutback).',
  },
  {
    name: 'Outside Zone',
    side: 'offense',
    explanation:
      'Carrera hacia fuera con bloqueo por zonas en carrera lateral (stretch). El objetivo es ganar el borde; si la defensa lo cierra, el RB corta hacia dentro.',
  },
  {
    name: 'Power',
    side: 'offense',
    explanation:
      'Carrera con bloqueo de gap (cada liniero bloquea su hueco hacia dentro) y el guard del lado contrario que sale tirando (pull) para bloquear al linebacker en el punto de ataque.',
  },
  {
    name: 'Counter',
    side: 'offense',
    explanation:
      'El RB da un paso hacia un lado para engañar y corre al contrario, detrás de dos jugadores que salen tirando (pull), normalmente el guard y el tackle o el TE del lado débil.',
  },
  {
    name: 'Zone Read',
    side: 'offense',
    explanation:
      'Carrera por zonas en la que se deja sin bloquear al defensive end del lado débil. El QB lo lee: si persigue al RB, el QB se queda el balón y corre; si espera al QB, se lo da al RB.',
  },
  {
    name: 'RPO',
    side: 'offense',
    explanation:
      'Run-Pass Option: la línea bloquea una carrera y el QB, tras el snap, decide entre dar el balón o lanzar un pase rápido según lo que haga un defensor concreto (normalmente un linebacker o un safety).',
  },
  // Defensa
  {
    name: 'Cover 0',
    side: 'defense',
    explanation:
      'Marcaje al hombre (man) sin ningún safety profundo de ayuda. Se usa con blitz: llegan más jugadores al QB de los que puede bloquear, pero un fallo en el marcaje puede acabar en touchdown.',
  },
  {
    name: 'Cover 1',
    side: 'defense',
    explanation:
      'Marcaje al hombre con un solo safety profundo en el centro de ayuda (free safety). Suele dejar un defensor libre para espiar al QB o para hacer blitz.',
  },
  {
    name: 'Cover 2',
    side: 'defense',
    explanation:
      'Dos safeties profundos se reparten el campo en dos mitades. Los cornerbacks se quedan abajo cubriendo los flats y los linebackers las zonas intermedias. Débil por el centro profundo y en la zona entre corner y safety.',
  },
  {
    name: 'Tampa 2',
    side: 'defense',
    explanation:
      'Variante de Cover 2 en la que el Mike (linebacker central) retrocede muy profundo por el centro del campo para tapar el hueco entre los dos safeties.',
  },
  {
    name: 'Cover 3',
    side: 'defense',
    explanation:
      'Tres defensores profundos (los dos cornerbacks y un safety) se reparten el campo en tres tercios. Por debajo, cuatro defensores cubren zonas cortas. Muy sólida contra el pase profundo; los flats y los curls son sus puntos débiles.',
  },
  {
    name: 'Cover 4',
    side: 'defense',
    explanation:
      'También llamada Quarters: cuatro defensores profundos se reparten el campo en cuartos. Los safeties leen al receptor interior y pueden subir a parar la carrera. Débil en los flats.',
  },
  {
    name: 'Blitz',
    side: 'defense',
    explanation:
      'Un linebacker o un defensive back ataca al QB además de la línea defensiva. Mete presión, pero deja menos jugadores en cobertura.',
  },
  {
    name: 'Zone Blitz',
    side: 'defense',
    explanation:
      'Blitz en el que un liniero defensivo retrocede a cubrir una zona en lugar del jugador que ataca al QB. Confunde a la línea ofensiva y al QB sin dejar huecos en la cobertura.',
  },
  {
    name: 'Stunt',
    side: 'defense',
    explanation:
      'Dos linieros defensivos cruzan sus caminos tras el snap (por ejemplo, el tackle va hacia fuera y el end entra por dentro) para desordenar los bloqueos de la línea ofensiva.',
  },
  // Special teams
  {
    name: 'Onside Kick',
    side: 'special',
    explanation:
      'Kickoff corto y rebotado para intentar recuperar el balón. Tiene que recorrer al menos 10 yardas antes de que el equipo que patea lo toque.',
  },
  {
    name: 'Fake Punt',
    side: 'special',
    explanation:
      'El equipo forma para patear un punt pero corre o pasa el balón para conseguir el primer down. Funciona si el equipo que recibe se retira pronto a bloquear.',
  },
  {
    name: 'Squib Kick',
    side: 'special',
    explanation:
      'Kickoff bajo y rodando por el suelo, difícil de atrapar limpio. Evita que el mejor returner del rival reciba la patada con ventaja.',
  },
];
