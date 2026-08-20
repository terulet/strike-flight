/**
 * Ranking del dia.
 *
 * Mi total = suma de mis mejores marcas en los retos que puntuan.
 * El total de un rival = sus marcas simuladas (deterministas) del dia mas los
 * ajustes del panel de debug. El evento CHAOS puntua aparte, no entra aqui.
 */
import type { SaveManager } from '../core/save';
import { RIVALS, rivalScore, type Rival } from './rivals';
import type { ChallengeSpec, DailyPlan } from './daily';

export interface Standing {
  id: string;
  name: string;
  color: string;
  isMe: boolean;
  total: number;
  perChallenge: Record<string, number>;
  /** Ha completado los tres retos de hoy. */
  played: boolean;
  /** Solo en grupo real: conectado ahora / ha abierto la app hoy. */
  online?: boolean;
  activeToday?: boolean;
}

/**
 * Con quien compito y con que marcas mias.
 *
 * Por defecto, rivales simulados y mis marcas locales: es exactamente el
 * comportamiento del modo "PROBAR SOLO". En grupo, la app pasa aqui los
 * jugadores reales y mis marcas ya combinadas con las del servidor.
 */
export interface RankingContext {
  others?: Standing[];
  myBest?: (challengeId: string) => number;
}

export interface Leaderboard {
  dayKey: string;
  standings: Standing[];
  me: Standing;
  myRank: number;
  leader: Standing;
}

/** Retos que suman al total del dia. El secreto solo cuenta si esta abierto. */
export function rankedChallenges(plan: DailyPlan, secretUnlocked: boolean): ChallengeSpec[] {
  const list = plan.challenges.filter((c) => c.countsForRanking);
  if (secretUnlocked) list.push(plan.secret);
  return list;
}

export function rivalTotals(
  plan: DailyPlan,
  rival: Rival,
  secretUnlocked: boolean,
  boost = 0,
): { total: number; perChallenge: Record<string, number> } {
  const perChallenge: Record<string, number> = {};
  let total = 0;
  for (const spec of rankedChallenges(plan, secretUnlocked)) {
    const score =
      rivalScore(rival, {
        dayKey: plan.dayKey,
        challengeId: spec.id,
        gameId: spec.gameId,
        skill: spec.skill,
        difficulty: spec.difficulty,
        scoreMultiplier: spec.scoreMultiplier,
      }) + boost;
    perChallenge[spec.id] = Math.max(0, score);
    total += perChallenge[spec.id] as number;
  }
  return { total, perChallenge };
}

export function myTotals(
  plan: DailyPlan,
  save: SaveManager,
  secretUnlocked: boolean,
  myBest?: (challengeId: string) => number,
): { total: number; perChallenge: Record<string, number>; played: boolean } {
  const day = save.get().days[plan.dayKey];
  const perChallenge: Record<string, number> = {};
  let total = 0;
  let playedAll = true;
  for (const spec of rankedChallenges(plan, secretUnlocked)) {
    const progress = day?.challenges[spec.id];
    const best = myBest ? myBest(spec.id) : (progress?.bestScore ?? 0);
    perChallenge[spec.id] = best;
    total += best;
    if (best <= 0 && (!progress || progress.plays === 0)) playedAll = false;
  }
  return { total, perChallenge, played: playedAll };
}

export function buildLeaderboard(
  plan: DailyPlan,
  save: SaveManager,
  secretUnlocked: boolean,
  context: RankingContext = {},
): Leaderboard {
  const data = save.get();
  const mine = myTotals(plan, save, secretUnlocked, context.myBest);
  const me: Standing = {
    id: 'me',
    name: data.profile.name,
    color: '#f8fafc',
    isMe: true,
    total: mine.total,
    perChallenge: mine.perChallenge,
    played: mine.played,
  };

  const others = context.others ?? botStandings(plan, save, secretUnlocked);
  const standings: Standing[] = [me, ...others];

  // Empate: primero quien ya ha jugado, luego alfabetico (estable).
  standings.sort((a, b) => b.total - a.total || Number(b.played) - Number(a.played) || a.name.localeCompare(b.name));

  const myRank = standings.findIndex((s) => s.isMe) + 1;
  return { dayKey: plan.dayKey, standings, me, myRank, leader: standings[0] as Standing };
}

/** Clasificacion de un unico reto (para el pique concreto). */
export function challengeStandings(
  plan: DailyPlan,
  save: SaveManager,
  spec: ChallengeSpec,
  context: RankingContext = {},
): Standing[] {
  const data = save.get();
  const day = data.days[plan.dayKey];
  const myBest = context.myBest
    ? context.myBest(spec.id)
    : (day?.challenges[spec.id]?.bestScore ?? 0);

  const list: Standing[] = [
    {
      id: 'me',
      name: data.profile.name,
      color: '#f8fafc',
      isMe: true,
      total: myBest,
      perChallenge: { [spec.id]: myBest },
      played: (day?.challenges[spec.id]?.plays ?? 0) > 0 || myBest > 0,
    },
  ];

  const others = context.others ?? botStandings(plan, save, true);
  for (const other of others) {
    const score = other.perChallenge[spec.id] ?? 0;
    list.push({ ...other, total: score, perChallenge: { [spec.id]: score } });
  }

  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return list;
}

/**
 * Rivales simulados. Vive aqui (y no en contenders.ts) para que ranking.ts no
 * dependa de la capa de red: contenders.ts importa de ranking, no al reves.
 */
export function botStandings(plan: DailyPlan, save: SaveManager, secretUnlocked: boolean): Standing[] {
  const day = save.get().days[plan.dayKey];
  const boosts = day?.rivalBoosts ?? {};
  const played = new Set(day?.rivalsPlayed ?? []);
  return RIVALS.map((rival) => {
    const totals = rivalTotals(plan, rival, secretUnlocked, boosts[rival.id] ?? 0);
    return {
      id: rival.id,
      name: rival.name,
      color: rival.color,
      isMe: false,
      total: totals.total,
      perChallenge: totals.perChallenge,
      played: played.has(rival.id),
    };
  });
}

export interface Gap {
  entry: Standing;
  gap: number;
}

/** El rival inmediatamente por delante de mi. null si voy primero. */
export function rivalAhead(standings: Standing[]): Gap | null {
  const index = standings.findIndex((s) => s.isMe);
  if (index <= 0) return null;
  const entry = standings[index - 1] as Standing;
  const me = standings[index] as Standing;
  return { entry, gap: entry.total - me.total };
}

/** El rival inmediatamente por detras. null si voy ultimo. */
export function rivalBehind(standings: Standing[]): Gap | null {
  const index = standings.findIndex((s) => s.isMe);
  if (index < 0 || index >= standings.length - 1) return null;
  const entry = standings[index + 1] as Standing;
  const me = standings[index] as Standing;
  return { entry, gap: me.total - entry.total };
}

export function rankOf(standings: Standing[], id: string): number {
  return standings.findIndex((s) => s.id === id) + 1;
}

/**
 * Separador de miles al estilo del juego: 8.420.
 *
 * A mano y no con toLocaleString: el locale es-ES no agrupa los numeros de
 * cuatro digitos (escribiria "8420"), y aqui queremos que TODAS las
 * puntuaciones se lean igual de grandes, en cualquier navegador.
 */
export function formatScore(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return sign + out;
}
