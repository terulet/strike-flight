/**
 * Mutadores.
 *
 * Un mutador NO es una variante de un juego: es un modificador de datos. Se
 * resuelven todos juntos en un unico MutatorState que el host y los minijuegos
 * leen. Anadir un mutador nuevo = anadir una entrada aqui. Ningun juego se
 * duplica ni se toca por ello.
 *
 * Reparto de responsabilidades:
 *  - los que el HOST aplica solo (funcionan en cualquier juego, presente o
 *    futuro): duracion, multiplicador de puntos, oscuridad, caos visual;
 *  - los que el JUEGO lee de su MutatorState: velocidad, ritmo de aparicion,
 *    gravedad, vidas, tamano, peligros extra, controles invertidos.
 */
export interface MutatorState {
  /** Multiplicador de velocidad general. */
  speed: number;
  /** Multiplicador del ritmo de aparicion de cosas. */
  spawnRate: number;
  /** Multiplicador de puntuacion (lo aplica la clase base al sumar). */
  scoreMultiplier: number;
  /** Multiplicador de la duracion del reto (lo aplica el host). */
  durationMultiplier: number;
  /** Vidas forzadas (null = las del juego). */
  lives: number | null;
  /** Escala de objetivos/jugador. */
  sizeMultiplier: number;
  /** Multiplicador de gravedad/inercia. */
  gravity: number;
  /** Peligros adicionales al empezar. */
  extraHazards: number;
  /** Controles invertidos. */
  invertControls: boolean;
  /** 0 = luz normal, 1 = a oscuras (lo pinta el host). */
  darkness: number;
  /** Modo caos: el host aumenta el feedback visual. */
  chaos: boolean;
}

export type MutatorTone = 'buff' | 'debuff' | 'chaos';

export interface MutatorDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  tone: MutatorTone;
  apply: (state: MutatorState) => void;
}

export function neutralMutators(): MutatorState {
  return {
    speed: 1,
    spawnRate: 1,
    scoreMultiplier: 1,
    durationMultiplier: 1,
    lives: null,
    sizeMultiplier: 1,
    gravity: 1,
    extraHazards: 0,
    invertControls: false,
    darkness: 0,
    chaos: false,
  };
}

const defs: MutatorDef[] = [
  {
    id: 'rush',
    name: 'ACELERON',
    icon: '»',
    description: 'Todo va un 50% mas rapido.',
    tone: 'debuff',
    apply: (s) => {
      s.speed *= 1.5;
      s.spawnRate *= 1.35;
    },
  },
  {
    id: 'heavy',
    name: 'GRAVEDAD X2',
    icon: '⇓',
    description: 'El doble de peso y de inercia.',
    tone: 'debuff',
    apply: (s) => {
      s.gravity *= 2;
    },
  },
  {
    id: 'onelife',
    name: 'UNA VIDA',
    icon: '!',
    description: 'Un solo fallo y se acabo.',
    tone: 'debuff',
    apply: (s) => {
      s.lives = 1;
    },
  },
  {
    id: 'blackout',
    name: 'APAGON',
    icon: '◐',
    description: 'Solo ves lo que tienes cerca.',
    tone: 'debuff',
    apply: (s) => {
      s.darkness = Math.max(s.darkness, 0.78);
    },
  },
  {
    id: 'mirror',
    name: 'ESPEJO',
    icon: '⇄',
    description: 'Controles invertidos.',
    tone: 'debuff',
    apply: (s) => {
      s.invertControls = !s.invertControls;
    },
  },
  {
    id: 'swarm',
    name: 'ENJAMBRE',
    icon: '▦',
    description: 'Mas obstaculos desde el primer segundo.',
    tone: 'debuff',
    apply: (s) => {
      s.extraHazards += 2;
      s.spawnRate *= 1.25;
    },
  },
  {
    id: 'sprint',
    name: 'SPRINT',
    icon: '⧗',
    description: 'Tiempo reducido: 30% menos.',
    tone: 'debuff',
    apply: (s) => {
      s.durationMultiplier *= 0.7;
    },
  },
  {
    id: 'tiny',
    name: 'MINIATURA',
    icon: '◦',
    description: 'Los objetivos son mas pequenos.',
    tone: 'debuff',
    apply: (s) => {
      s.sizeMultiplier *= 0.72;
    },
  },
  {
    id: 'double',
    name: 'PUNTOS X2',
    icon: '×2',
    description: 'Cada punto vale el doble.',
    tone: 'buff',
    apply: (s) => {
      s.scoreMultiplier *= 2;
    },
  },
  {
    id: 'chaos',
    name: 'CAOS',
    icon: '✷',
    description: 'Rapido, oscuro, pequeno y con puntos x2.5.',
    tone: 'chaos',
    apply: (s) => {
      s.chaos = true;
      s.speed *= 1.4;
      s.spawnRate *= 1.3;
      s.scoreMultiplier *= 2.5;
      s.sizeMultiplier *= 0.85;
      s.darkness = Math.max(s.darkness, 0.3);
      s.extraHazards += 1;
    },
  },
];

export const MUTATORS: Record<string, MutatorDef> = Object.fromEntries(
  defs.map((def) => [def.id, def]),
);

export const MUTATOR_IDS: string[] = defs.map((d) => d.id);

/** Ids que salen en la rotacion diaria normal (el caos se reserva al evento). */
export const DAILY_MUTATOR_POOL: string[] = [
  'rush',
  'onelife',
  'blackout',
  'mirror',
  'swarm',
  'sprint',
  'double',
  'tiny',
  'heavy',
];

export function getMutator(id: string): MutatorDef | null {
  return MUTATORS[id] ?? null;
}

/** Combina una lista de ids en un unico estado. Ignora ids desconocidos. */
export function resolveMutators(ids: readonly string[]): MutatorState {
  const state = neutralMutators();
  for (const id of ids) {
    const def = MUTATORS[id];
    if (def) def.apply(state);
  }
  // Cinturon de seguridad: ninguna combinacion debe dejar el juego injugable.
  state.speed = clamp(state.speed, 0.5, 3);
  state.spawnRate = clamp(state.spawnRate, 0.5, 3);
  state.durationMultiplier = clamp(state.durationMultiplier, 0.4, 2);
  state.sizeMultiplier = clamp(state.sizeMultiplier, 0.45, 2);
  state.gravity = clamp(state.gravity, 0.5, 3);
  state.darkness = clamp(state.darkness, 0, 0.85);
  state.scoreMultiplier = clamp(state.scoreMultiplier, 0.5, 5);
  return state;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function describeMutators(ids: readonly string[]): MutatorDef[] {
  return ids.map((id) => MUTATORS[id]).filter((d): d is MutatorDef => Boolean(d));
}
