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
): { total: number; perChallenge: Record<string, number>; played: boolean } {
  const day = save.get().days[plan.dayKey];
  const perChallenge: Record<string, number> = {};
  let total = 0;
  let playedAll = true;
  for (const spec of rankedChallenges(plan, secretUnlocked)) {
    const progress = day?.challenges[spec.id];
    const best = progress?.bestScore ?? 0;
    perChallenge[spec.id] = best;
    total += best;
    if (!progress || progress.plays === 0) playedAll = false;
  }
  return { total, perChallenge, played: playedAll };
}

export function buildLeaderboard(plan: DailyPlan, save: SaveManager, secretUnlocked: boolean): Leaderboard {
  const data = save.get();
  const day = data.days[plan.dayKey];
  const boosts = day?.rivalBoosts ?? {};
  const rivalsPlayed = new Set(day?.rivalsPlayed ?? []);

  const mine = myTotals(plan, save, secretUnlocked);
  const me: Standing = {
    id: 'me',
    name: data.profile.name,
    color: '#f8fafc',
    isMe: true,
    total: mine.total,
    perChallenge: mine.perChallenge,
    played: mine.played,
  };

  const standings: Standing[] = [me];
  for (const rival of RIVALS) {
    const totals = rivalTotals(plan, rival, secretUnlocked, boosts[rival.id] ?? 0);
    standings.push({
      id: rival.id,
      name: rival.name,
      color: rival.color,
      isMe: false,
      total: totals.total,
      perChallenge: totals.perChallenge,
      played: rivalsPlayed.has(rival.id),
    });
  }

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
): Standing[] {
  const data = save.get();
  const day = data.days[plan.dayKey];
  const boosts = day?.rivalBoosts ?? {};
  const myBest = day?.challenges[spec.id]?.bestScore ?? 0;

  const list: Standing[] = [
    {
      id: 'me',
      name: data.profile.name,
      color: '#f8fafc',
      isMe: true,
      total: myBest,
      perChallenge: { [spec.id]: myBest },
      played: (day?.challenges[spec.id]?.plays ?? 0) > 0,
    },
  ];

  for (const rival of RIVALS) {
    const score =
      rivalScore(rival, {
        dayKey: plan.dayKey,
        challengeId: spec.id,
        gameId: spec.gameId,
        skill: spec.skill,
        difficulty: spec.difficulty,
        scoreMultiplier: spec.scoreMultiplier,
      }) + (boosts[rival.id] ?? 0);
    list.push({
      id: rival.id,
      name: rival.name,
      color: rival.color,
      isMe: false,
      total: Math.max(0, score),
      perChallenge: { [spec.id]: Math.max(0, score) },
      played: (day?.rivalsPlayed ?? []).includes(rival.id),
    });
  }

  list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return list;
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

/** Separador de miles al estilo del juego: 8.420 */
export function formatScore(value: number): string {
  return Math.round(value).toLocaleString('es-ES');
}
