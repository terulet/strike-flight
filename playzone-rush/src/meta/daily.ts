/**
 * Rotacion diaria.
 *
 * No hay servidor: el dia SE CALCULA. La clave del dia (YYYY-MM-DD) es la
 * semilla de todo, asi que el mismo dia produce siempre los mismos retos, los
 * mismos mutadores y las mismas marcas de los rivales, en cualquier maquina.
 * Cuando llegue el backend, este modulo se sustituye por una descarga y el
 * resto del juego no se entera.
 */
import { Rng, seedFrom } from '../core/rng';
import type { SkillKind } from '../game/contract';
import { listGames } from '../game/registry';
import { DAILY_MUTATOR_POOL, resolveMutators } from '../game/mutators';
import { juegosDelDia } from './rotacion';

export type ChallengeKind = 'daily' | 'secret' | 'chaos';

export interface GameCatalogEntry {
  id: string;
  name: string;
  skill: SkillKind;
  defaultDurationMs: number;
  /** Mutadores que el juego declara soportar (undefined = todos). */
  supportedMutators?: string[];
}

export interface ChallengeSpec {
  /** Estable dentro del dia: 'c1', 'c2', 'c3', 'secret', 'chaos'. */
  id: string;
  index: number;
  title: string;
  kind: ChallengeKind;
  gameId: string;
  gameName: string;
  skill: SkillKind;
  /** Semilla exacta de la partida. */
  seed: string;
  baseDurationMs: number;
  /** Duracion final, con el mutador de tiempo ya aplicado. */
  durationMs: number;
  difficulty: number;
  mutatorIds: string[];
  attempts: number;
  /** Si suma al ranking diario (el evento CHAOS puntua aparte). */
  countsForRanking: boolean;
  /** Multiplicador de puntos resultante (para simular a los rivales). */
  scoreMultiplier: number;
}

export interface DailyPlan {
  dayKey: string;
  seed: string;
  /** Los tres retos del dia. */
  challenges: ChallengeSpec[];
  secret: ChallengeSpec;
  chaos: ChallengeSpec;
}

export const DAILY_ATTEMPTS = 3;
export const SECRET_ATTEMPTS = 1;
export const CHAOS_ATTEMPTS = 1;

/**
 * De donde sale la vuelta de tuerca del reto secreto cuando el apagon no vale.
 *
 * El apagon es una vineta pegada al dedo, asi que hay juegos donde no es una
 * dificultad sino una imposibilidad: en CUENTA hay que comparar dos nubes a la
 * vez y en TRILE hay que vigilar toda la pantalla. Esos juegos lo declaran como
 * no soportado, y el filtro de supportedFor() lo quitaba en silencio: el reto
 * secreto se quedaba en "puntos dobles", sin nada de secreto. Pasaba un dia de
 * cada veintidos, que es justo la frecuencia con la que una cosa asi no se
 * detecta a mano.
 *
 * En orden de preferencia. El primero que el juego entienda, ese.
 */
export const SECRET_TWISTS = ['blackout', 'mirror', 'tiny', 'sprint'];

export function catalogFromRegistry(): GameCatalogEntry[] {
  return listGames().map((def) => ({
    id: def.meta.id,
    name: def.meta.name,
    skill: def.meta.skill,
    defaultDurationMs: def.meta.defaultDurationMs,
    supportedMutators: def.meta.supportedMutators,
  }));
}

/** Filtra los mutadores que ese juego no entiende. Nada de combinaciones absurdas. */
export function supportedFor(game: GameCatalogEntry, mutatorIds: string[]): string[] {
  if (!game.supportedMutators) return mutatorIds;
  const allowed = new Set(game.supportedMutators);
  return mutatorIds.filter((id) => allowed.has(id));
}

function makeChallenge(
  dayKey: string,
  id: string,
  index: number,
  title: string,
  kind: ChallengeKind,
  game: GameCatalogEntry,
  difficulty: number,
  requestedMutators: string[],
  attempts: number,
  countsForRanking: boolean,
): ChallengeSpec {
  const mutatorIds = supportedFor(game, requestedMutators);
  const mutators = resolveMutators(mutatorIds);
  return {
    id,
    index,
    title,
    kind,
    gameId: game.id,
    gameName: game.name,
    skill: game.skill,
    seed: seedFrom(dayKey, id, game.id),
    baseDurationMs: game.defaultDurationMs,
    durationMs: Math.round(game.defaultDurationMs * mutators.durationMultiplier),
    difficulty,
    mutatorIds,
    attempts,
    countsForRanking,
    scoreMultiplier: mutators.scoreMultiplier,
  };
}

/**
 * Los mutadores del reto secreto para un juego concreto: siempre puntos
 * dobles, mas la primera vuelta de tuerca de SECRET_TWISTS que ese juego
 * entienda. Nunca se queda en solo dobles.
 */
function torcer(game: GameCatalogEntry): string[] {
  const twist = SECRET_TWISTS.find((id) => supportedFor(game, [id]).length > 0);
  return twist ? [twist, 'double'] : ['double'];
}

const DIFFICULTIES = [0.15, 0.38, 0.62];
const MUTATOR_COUNTS = [0, 1, 2];

/**
 * Construye el dia completo. Determinista: buildDailyPlan(k) === buildDailyPlan(k).
 */
export function buildDailyPlan(dayKey: string, catalog: GameCatalogEntry[] = catalogFromRegistry()): DailyPlan {
  if (catalog.length === 0) throw new Error('[daily] no hay ningun minijuego registrado');

  const seed = seedFrom('day', dayKey);
  const rng = new Rng(seed);

  // Que juegos tocan hoy no lo decide esta semilla, sino la bolsa: barajar de
  // cero cada dia repetia el 87% de los dias. Ver meta/rotacion.ts.
  const porId = new Map(catalog.map((g) => [g.id, g]));
  const picks = juegosDelDia(dayKey, catalog.map((g) => g.id)).map(
    (id) => porId.get(id) as GameCatalogEntry,
  );

  // Mutadores del dia: distintos entre si para que los tres retos no rimen.
  const pool = rng.shuffle(DAILY_MUTATOR_POOL);
  let poolIndex = 0;
  const takeMutators = (count: number): string[] => {
    const out: string[] = [];
    while (out.length < count && poolIndex < pool.length) out.push(pool[poolIndex++] as string);
    return out;
  };

  const challenges = picks.map((game, i) =>
    makeChallenge(
      dayKey,
      `c${i + 1}`,
      i,
      `RETO ${i + 1}`,
      'daily',
      game,
      DIFFICULTIES[i] as number,
      takeMutators(MUTATOR_COUNTS[i] as number),
      DAILY_ATTEMPTS,
      true,
    ),
  );

  // Se prefiere un juego que SI pueda jugarse a oscuras, para que el reto
  // secreto siga siendo el reto a oscuras casi siempre. Solo si ninguno de los
  // tres puede, se le busca otra vuelta de tuerca.
  const aOscuras = picks.filter((g) => supportedFor(g, ['blackout']).length > 0);
  const secretGame = rng.pick(aOscuras.length > 0 ? aOscuras : picks);
  const secret = makeChallenge(
    dayKey,
    'secret',
    3,
    'RETO SECRETO',
    'secret',
    secretGame,
    0.7,
    torcer(secretGame),
    SECRET_ATTEMPTS,
    true,
  );

  const chaosGame = rng.pick(picks);
  const chaosExtra = rng.pick(['mirror', 'swarm', 'sprint', 'tiny']);
  const chaos = makeChallenge(
    dayKey,
    'chaos',
    4,
    'EVENTO CHAOS',
    'chaos',
    chaosGame,
    0.85,
    ['chaos', chaosExtra],
    CHAOS_ATTEMPTS,
    false,
  );

  return { dayKey, seed, challenges, secret, chaos };
}

/** Los tres retos + secreto + chaos, en orden de presentacion. */
export function allChallenges(plan: DailyPlan): ChallengeSpec[] {
  return [...plan.challenges, plan.secret, plan.chaos];
}

export function findChallenge(plan: DailyPlan, challengeId: string): ChallengeSpec | null {
  return allChallenges(plan).find((c) => c.id === challengeId) ?? null;
}

/** mm:ss para las tarjetas. */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
