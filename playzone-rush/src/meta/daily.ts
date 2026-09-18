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

/** Mutadores fijos del reto secreto: a oscuras y con puntos dobles. */
export const SECRET_MUTATORS = ['blackout', 'double'];

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

const DIFFICULTIES = [0.15, 0.38, 0.62];
const MUTATOR_COUNTS = [0, 1, 2];

/** Retos por dia y dias por vuelta: 7 x 3 = 21 juegos sin repetir. */
export const CHALLENGES_PER_DAY = 3;
export const DAYS_PER_WEEK = 7;

/** Dias enteros desde 1970 para una clave AAAA-MM-DD. */
function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Dia 0 de 1970 fue jueves, asi que sumando 3 las semanas empiezan en lunes.
 * Importa: "esta semana" tiene que significar lo mismo para el reparto que
 * para la persona que juega.
 */
function weekAndSlot(dayKey: string): { week: number; slot: number } {
  const shifted = dayNumber(dayKey) + 3;
  const week = Math.floor(shifted / DAYS_PER_WEEK);
  return { week, slot: ((shifted % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK };
}

/** La baraja de una semana, sin mirar lo que paso en la anterior. */
function rawDeck(week: number, catalog: GameCatalogEntry[]): GameCatalogEntry[] {
  const need = DAYS_PER_WEEK * CHALLENGES_PER_DAY;
  const deck: GameCatalogEntry[] = [];
  for (let pass = 0; deck.length < need; pass++) {
    const bag = new Rng(seedFrom('week', week, pass)).shuffle(catalog);
    while (bag.length > 0 && deck.length < need) {
      // Lo que ya ha caido hoy: se salta para no repetir dentro del dia.
      const dayStart = Math.floor(deck.length / CHALLENGES_PER_DAY) * CHALLENGES_PER_DAY;
      const today = deck.slice(dayStart).map((g) => g.id);
      let i = bag.findIndex((g) => !today.includes(g.id));
      if (i < 0) i = 0; // catalogo diminuto: no queda otra que repetir
      deck.push(bag.splice(i, 1)[0] as GameCatalogEntry);
    }
  }
  return deck;
}

/**
 * Los 21 retos de una semana, repartidos de tres en tres.
 *
 * Antes cada dia barajaba el catalogo entero por su cuenta y cogia tres: dos
 * dias seguidos podian sacar el mismo juego aunque hubiera cincuenta en el
 * catalogo. Aqui se reparte una sola baraja para toda la semana, asi que con
 * 21 juegos la semana entera sale sin repetir ni uno.
 *
 * El lunes se corrige aparte: se mira la cola del domingo anterior y, si algo
 * coincide, se cambia por un juego del medio de la semana. Sin esto, la unica
 * repeticion visible seria justo la de dos dias seguidos, que es la que canta.
 *
 * Con menos juegos que 21 se barajan pasadas sucesivas: se agotan todos antes
 * de que ninguno vuelva a salir, y dentro de un mismo dia nunca se repite.
 */
function weekDeck(week: number, catalog: GameCatalogEntry[]): GameCatalogEntry[] {
  const deck = rawDeck(week, catalog);
  if (catalog.length <= CHALLENGES_PER_DAY * 2) return deck; // no hay margen para cambiar nada
  const ayer = rawDeck(week - 1, catalog)
    .slice(-CHALLENGES_PER_DAY)
    .map((g) => g.id);

  for (let i = 0; i < CHALLENGES_PER_DAY; i++) {
    const actual = deck[i] as GameCatalogEntry;
    if (!ayer.includes(actual.id)) continue;
    const lunes = deck.slice(0, CHALLENGES_PER_DAY).map((g) => g.id);
    // Se busca recambio en el medio: tocar los ultimos tres cambiaria la cola
    // que la semana siguiente va a mirar, y el arreglo se perseguiria la cola.
    const j = deck.findIndex(
      (g, k) =>
        k >= CHALLENGES_PER_DAY &&
        k < deck.length - CHALLENGES_PER_DAY &&
        !ayer.includes(g.id) &&
        !lunes.includes(g.id),
    );
    if (j < 0) continue;
    deck[i] = deck[j] as GameCatalogEntry;
    deck[j] = actual;
  }
  return deck;
}

/** Los tres juegos que tocan hoy. */
export function picksForDay(dayKey: string, catalog: GameCatalogEntry[]): GameCatalogEntry[] {
  const { week, slot } = weekAndSlot(dayKey);
  const deck = weekDeck(week, catalog);
  return deck.slice(slot * CHALLENGES_PER_DAY, (slot + 1) * CHALLENGES_PER_DAY);
}

/**
 * Construye el dia completo. Determinista: buildDailyPlan(k) === buildDailyPlan(k).
 */
export function buildDailyPlan(dayKey: string, catalog: GameCatalogEntry[] = catalogFromRegistry()): DailyPlan {
  if (catalog.length === 0) throw new Error('[daily] no hay ningun minijuego registrado');

  const seed = seedFrom('day', dayKey);
  const rng = new Rng(seed);
  const picks = picksForDay(dayKey, catalog);

  // Mutadores del dia: distintos entre si para que los tres retos no rimen.
  //
  // Se reparten mirando lo que cada juego entiende. Cogiendo a ciegas y
  // filtrando despues, un reto cuyo juego no soportara el mutador que le tocaba
  // se quedaba sin ninguno: anunciado como reto con mutador, y luego pelado.
  const pool = rng.shuffle(DAILY_MUTATOR_POOL);
  const usados = new Set<string>();
  const takeMutators = (count: number, game: GameCatalogEntry): string[] => {
    const out: string[] = [];
    for (const id of pool) {
      if (out.length >= count) break;
      if (usados.has(id)) continue;
      if (supportedFor(game, [id]).length === 0) continue;
      usados.add(id);
      out.push(id);
    }
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
      takeMutators(MUTATOR_COUNTS[i] as number, game),
      DAILY_ATTEMPTS,
      true,
    ),
  );

  const secretGame = rng.pick(picks);
  const secret = makeChallenge(
    dayKey,
    'secret',
    3,
    'RETO SECRETO',
    'secret',
    secretGame,
    0.7,
    SECRET_MUTATORS,
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
