/**
 * "Marc te ha quitado el #1".
 *
 * Detectar un adelantamiento parece trivial y no lo es: hay que distinguir
 * "alguien me ha pasado ahora mismo" de "alguien ya estaba por delante cuando
 * cerre la app ayer". Por eso guardamos la ultima foto de totales que vimos y
 * comparamos contra ella, no contra el ranking actual.
 */
import type { SaveManager } from '../core/save';
import type { Standing } from './ranking';

export interface OvertakeEvent {
  rivalId: string;
  rivalName: string;
  theirTotal: number;
  myTotal: number;
  gap: number;
  /** Clave para no avisar dos veces del mismo adelantamiento. */
  key: string;
}

export interface OvertakeInput {
  dayKey: string;
  standings: Standing[];
  /** Totales que vimos la ultima vez (incluye 'me'). */
  previous: Record<string, number> | undefined;
  seen: string[];
}

/**
 * Devuelve los adelantamientos nuevos: rivales que antes estaban por detras
 * (o empatados) y ahora estan por delante.
 */
export function detectOvertakes(input: OvertakeInput): OvertakeEvent[] {
  const me = input.standings.find((s) => s.isMe);
  if (!me || !input.previous) return [];

  const previousMine = input.previous.me;
  if (previousMine === undefined) return [];

  const seen = new Set(input.seen);
  const events: OvertakeEvent[] = [];

  for (const rival of input.standings) {
    if (rival.isMe) continue;
    const before = input.previous[rival.id];
    if (before === undefined) continue; // no lo habiamos visto: no es un adelantamiento
    const wasBehind = before <= previousMine;
    const isAhead = rival.total > me.total;
    if (!wasBehind || !isAhead) continue;
    if (rival.total <= before) continue; // no ha mejorado: he bajado yo (imposible) o empate

    const key = `${input.dayKey}:${rival.id}:${rival.total}`;
    if (seen.has(key)) continue;
    events.push({
      rivalId: rival.id,
      rivalName: rival.name,
      theirTotal: rival.total,
      myTotal: me.total,
      gap: rival.total - me.total,
      key,
    });
  }

  return events.sort((a, b) => a.gap - b.gap);
}

/** Guarda la foto de totales actual para poder comparar la proxima vez. */
export function rememberTotals(save: SaveManager, dayKey: string, standings: Standing[]): void {
  save.update((data) => {
    const totals: Record<string, number> = {};
    for (const standing of standings) totals[standing.isMe ? 'me' : standing.id] = standing.total;
    data.social.lastTotals[dayKey] = totals;
    // No hace falta guardar la historia entera: con los ultimos dias sobra.
    const days = Object.keys(data.social.lastTotals).sort();
    while (days.length > 7) {
      const oldest = days.shift();
      if (oldest) delete data.social.lastTotals[oldest];
    }
  });
}

export function markOvertakesSeen(save: SaveManager, keys: string[]): void {
  if (keys.length === 0) return;
  save.update((data) => {
    const set = new Set(data.social.seenOvertakes);
    for (const key of keys) set.add(key);
    data.social.seenOvertakes = Array.from(set).slice(-200);
  });
}

/**
 * Con que reto conviene responder: aquel donde el rival que me ha pasado esta
 * mas cerca y todavia me quedan intentos.
 */
export interface RevengeTarget {
  challengeId: string;
  rivalId: string;
  rivalName: string;
  rivalScore: number;
  myScore: number;
  gap: number;
}

export function bestRevengeAgainst(
  rivalId: string,
  challengeIds: string[],
  scoreOf: (playerId: string, challengeId: string) => number,
  playable: (challengeId: string) => boolean,
  rivalName: string,
): RevengeTarget | null {
  let best: RevengeTarget | null = null;
  for (const challengeId of challengeIds) {
    if (!playable(challengeId)) continue;
    const rivalScore = scoreOf(rivalId, challengeId);
    const myScore = scoreOf('me', challengeId);
    if (rivalScore <= 0) continue;
    const gap = rivalScore - myScore;
    if (gap <= 0) continue;
    if (!best || gap < best.gap) {
      best = { challengeId, rivalId, rivalName, rivalScore, myScore, gap };
    }
  }
  return best;
}
