/**
 * El grupo. Sin backend: los rivales son simulados, pero NO son aleatorios.
 *
 * Cada rival tiene un perfil de habilidad por tipo de juego y una constancia.
 * Su marca de un dia sale de una semilla (dia + reto + rival), asi que es
 * estable: si recargas la pagina, Marc sigue teniendo la misma puntuacion.
 * Cuando exista backend, esto se sustituye por marcas reales sin tocar la UI.
 */
import { Rng, seedFrom } from '../core/rng';
import type { SkillKind } from '../game/contract';

export interface Rival {
  id: string;
  name: string;
  color: string;
  /** 0..1 por tipo de habilidad. */
  skill: Record<SkillKind, number>;
  /** 0..1: cuanto se parecen sus dias entre si. */
  consistency: number;
  /** Frase para el contexto social. */
  vibe: string;
}

export const RIVALS: Rival[] = [
  {
    id: 'marc',
    name: 'MARC',
    color: '#ff6b6b',
    skill: {
      reflejos: 0.82, supervivencia: 0.66, precision: 0.74, memoria: 0.6, ritmo: 0.77, trazo: 0.58, inhibicion: 0.55,
      busqueda: 0.68, calculo: 0.71, seguimiento: 0.6,
    },
    consistency: 0.72,
    vibe: 'Juega a las 8 de la mañana y no lo dice.',
  },
  {
    id: 'kali',
    name: 'KALI',
    color: '#22d3ee',
    skill: {
      reflejos: 0.63, supervivencia: 0.86, precision: 0.58, memoria: 0.71, ritmo: 0.52, trazo: 0.74, inhibicion: 0.8,
      busqueda: 0.75, calculo: 0.57, seguimiento: 0.88,
    },
    consistency: 0.55,
    vibe: 'O queda primera o queda ultima.',
  },
  {
    id: 'yoli',
    name: 'YOLI',
    color: '#f472b6',
    skill: {
      reflejos: 0.7, supervivencia: 0.6, precision: 0.83, memoria: 0.88, ritmo: 0.86, trazo: 0.9, inhibicion: 0.72,
      busqueda: 0.84, calculo: 0.79, seguimiento: 0.76,
    },
    consistency: 0.8,
    vibe: 'Nunca falla dos veces la misma diana.',
  },
  {
    id: 'silvia',
    name: 'SILVIA',
    color: '#a3e635',
    skill: {
      reflejos: 0.58, supervivencia: 0.72, precision: 0.69, memoria: 0.64, ritmo: 0.61, trazo: 0.67, inhibicion: 0.63,
      busqueda: 0.6, calculo: 0.66, seguimiento: 0.65,
    },
    consistency: 0.62,
    vibe: 'Empieza floja y remonta al tercer intento.',
  },
];

export const RIVAL_IDS: string[] = RIVALS.map((r) => r.id);

export function getRival(id: string): Rival | null {
  return RIVALS.find((r) => r.id === id) ?? null;
}

/**
 * Rango de puntuacion tipico por juego. Es la unica pieza que hay que tocar al
 * meter un juego nuevo en la rotacion; si falta, se usa el rango por defecto.
 */
export const GAME_BASELINES: Record<string, { low: number; high: number }> = {
  // Calibrados con el bot de tools/playtest.mjs: el techo de un jugador
  // perfecto ronda los 5.000-7.000 en los tres. Los rivales se quedan un
  // escalon por debajo (3.000-5.200) para que el primer dia se pueda ganar
  // jugando bien, no solo despues de una semana de practica.
  pulse: { low: 1600, high: 4600 },
  drift: { low: 1400, high: 5200 },
  snap: { low: 1300, high: 4100 },
  memory: { low: 1500, high: 4800 },
  // Calibrados igual, con tools/playtest.mjs, cuando entraron en la rotacion.
  // Sin esta linea un juego cae en DEFAULT_BASELINE y los rivales sacan la
  // misma marca en un juego generoso que en uno tacano: se nota enseguida
  // porque el mismo rival queda primero un dia y ultimo al siguiente sin que
  // haya pasado nada.
  ritmo: { low: 1500, high: 4700 },
  trazo: { low: 1200, high: 3900 },
  freno: { low: 1300, high: 4300 },
  caza: { low: 1400, high: 4500 },
  cuenta: { low: 1600, high: 5000 },
  torre: { low: 1200, high: 4400 },
  trile: { low: 1300, high: 4200 },
  carga: { low: 1500, high: 4900 },
};

const DEFAULT_BASELINE = { low: 1500, high: 4200 };

export function baselineFor(gameId: string): { low: number; high: number } {
  return GAME_BASELINES[gameId] ?? DEFAULT_BASELINE;
}

export interface RivalScoreInput {
  dayKey: string;
  challengeId: string;
  gameId: string;
  skill: SkillKind;
  difficulty: number;
  scoreMultiplier: number;
}

/** Marca (determinista) de un rival en un reto concreto de un dia concreto. */
export function rivalScore(rival: Rival, input: RivalScoreInput): number {
  const rng = new Rng(seedFrom('score', input.dayKey, input.challengeId, rival.id));
  const base = baselineFor(input.gameId);
  const ability = rival.skill[input.skill] ?? 0.65;

  // Dia bueno / dia malo: cuanto menos constante, mas se mueve.
  const swing = (1 - rival.consistency) * 0.42;
  const mood = 1 + rng.range(-swing, swing);

  // Los retos dificiles aprietan a todo el mundo un poco.
  const pressure = 1 - input.difficulty * 0.12;

  const raw = (base.low + (base.high - base.low) * ability) * mood * pressure * input.scoreMultiplier;
  return Math.max(200, Math.round(raw / 10) * 10);
}

/**
 * Tiempo que aguanto un rival en un juego de supervivencia (para el fantasma).
 * Se deriva de su marca para que marca y fantasma cuenten la misma historia.
 */
export function rivalSurvivalMs(score: number, durationMs: number, gameId: string): number {
  const base = baselineFor(gameId);
  const ratio = (score - base.low) / Math.max(1, base.high - base.low);
  const clamped = Math.max(0.12, Math.min(0.97, ratio));
  return Math.round(durationMs * clamped);
}
