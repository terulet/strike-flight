/**
 * Ganador del dia, corona y racha.
 *
 * Un dia se "cierra" cuando ya ha pasado: se mira quien tuvo el total mas alto
 * y se guarda. Los dias anteriores a la instalacion no se inventan: se calculan
 * con las mismas marcas deterministas de los rivales (yo no jugue, asi que no
 * aparezco), lo que da contexto social desde el primer arranque sin mentir.
 */
import { addDays } from '../core/clock';
import type { SaveManager } from '../core/save';
import { buildDailyPlan, type DailyPlan } from './daily';
import { buildLeaderboard, rivalTotals } from './ranking';
import { RIVALS } from './rivals';

export interface DayWinner {
  dayKey: string;
  id: string;
  name: string;
  total: number;
  /** Si ese dia llegue a jugar. */
  iPlayed: boolean;
}

export interface StreakInfo {
  holderId: string | null;
  holderName: string | null;
  days: number;
}

export interface WinnerOptions {
  /**
   * true  (modo solo): si yo no jugue ese dia, gana el mejor bot simulado.
   * false (grupo real): si no tenemos datos de ese dia, no hay ganador. No
   *       vamos a inventarnos que gano alguien de carne y hueso.
   */
  simulate?: boolean;
}

/** Ganador de un dia cualquiera (jugado o no). No escribe en el save. */
export function winnerOfDay(
  save: SaveManager,
  dayKey: string,
  plan?: DailyPlan,
  options: WinnerOptions = {},
): DayWinner {
  const data = save.get();
  const day = data.days[dayKey];
  const dayPlan = plan ?? buildDailyPlan(dayKey);
  const secretUnlocked = Boolean(day?.secretUnlocked);
  const iPlayed = Boolean(
    day && Object.values(day.challenges).some((c) => c.plays > 0),
  );

  if (iPlayed) {
    const board = buildLeaderboard(dayPlan, save, secretUnlocked);
    const leader = board.leader;
    return { dayKey, id: leader.isMe ? 'me' : leader.id, name: leader.name, total: leader.total, iPlayed };
  }

  if (options.simulate === false) {
    // Sin datos reales de ese dia: no hay ganador que contar.
    return { dayKey, id: '', name: '', total: 0, iPlayed: false };
  }

  // Sin mi: gana el mejor de los rivales simulados.
  let best = { id: '', name: '', total: -1 };
  for (const rival of RIVALS) {
    const totals = rivalTotals(dayPlan, rival, secretUnlocked, day?.rivalBoosts[rival.id] ?? 0);
    if (totals.total > best.total) best = { id: rival.id, name: rival.name, total: totals.total };
  }
  return { dayKey, id: best.id, name: best.name, total: best.total, iPlayed };
}

/** Cierra un dia y guarda su ganador. Idempotente. */
export function resolveDay(save: SaveManager, dayKey: string): DayWinner {
  const existing = save.get().days[dayKey]?.resolvedWinner;
  const winner = winnerOfDay(save, dayKey);
  if (existing === winner.id) return winner;
  save.update(() => {
    save.day(dayKey).resolvedWinner = winner.id;
  });
  return winner;
}

/**
 * Racha actual: cuantos dias seguidos ha ganado el ultimo ganador,
 * mirando hacia atras desde ayer (hoy aun no ha terminado).
 */
export function computeStreak(
  save: SaveManager,
  todayKey: string,
  lookback = 30,
  options: WinnerOptions = {},
): StreakInfo {
  let cursor = addDays(todayKey, -1);
  const first = winnerOfDay(save, cursor, undefined, options);
  if (!first.id) return { holderId: null, holderName: null, days: 0 };

  let days = 1;
  for (let i = 1; i < lookback; i++) {
    cursor = addDays(cursor, -1);
    const winner = winnerOfDay(save, cursor, undefined, options);
    if (winner.id !== first.id) break;
    days++;
  }
  return { holderId: first.id, holderName: first.name, days };
}

/** Cierra todos los dias pendientes anteriores a hoy en los que jugue. */
export function resolvePendingDays(save: SaveManager, todayKey: string): DayWinner[] {
  const resolved: DayWinner[] = [];
  const keys = Object.keys(save.get().days)
    .filter((key) => key < todayKey)
    .sort();
  for (const key of keys) {
    const day = save.get().days[key];
    if (!day || day.resolvedWinner !== null) continue;
    resolved.push(resolveDay(save, key));
  }
  if (resolved.length > 0) {
    const streak = computeStreak(save, todayKey);
    save.update((data) => {
      data.streak.holder = streak.holderId;
      data.streak.days = streak.days;
      data.streak.lastResolvedDay = resolved[resolved.length - 1]?.dayKey ?? data.streak.lastResolvedDay;
    });
  }
  return resolved;
}
