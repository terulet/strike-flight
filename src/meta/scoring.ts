/**
 * Cierre de una partida: guarda la marca y calcula TODO lo que la pantalla de
 * resultado necesita para picar al jugador (records, adelantamientos, cuanto
 * te falta para el siguiente).
 *
 * Es una funcion pura sobre el save: se puede testear sin navegador.
 */
import type { SaveManager } from '../core/save';
import type { GameResult } from '../game/contract';
import { attemptsLeft } from './attempts';
import type { ChallengeSpec, DailyPlan } from './daily';
import {
  buildLeaderboard,
  challengeStandings,
  rankOf,
  rivalAhead,
  type Gap,
  type Standing,
} from './ranking';

export interface CommitInput {
  plan: DailyPlan;
  spec: ChallengeSpec;
  save: SaveManager;
  result: GameResult;
  secretUnlocked: boolean;
  ghostPassed?: boolean;
}

export interface ScoreOutcome {
  challengeId: string;
  score: number;
  previousBest: number;
  /** Ha mejorado su mejor intento de hoy en este reto. */
  isChallengeBest: boolean;
  /** Ha batido su record historico en ese juego. */
  isPersonalRecord: boolean;
  gainVsBest: number;
  attemptsLeft: number;
  rankBefore: number;
  rankAfter: number;
  /** Rivales que estaban por delante y ahora estan por detras. */
  overtook: Standing[];
  becameLeader: boolean;
  /** Siguiente objetivo en el ranking del dia. */
  target: Gap | null;
  /** Siguiente objetivo en ESTE reto (el pique concreto). */
  challengeTarget: Gap | null;
  challengeRank: number;
  dailyTotal: number;
  isDailyTotalRecord: boolean;
  ghostPassed: boolean;
  chaos: boolean;
}

export function commitResult(input: CommitInput): ScoreOutcome {
  const { plan, spec, save, result } = input;
  const dayKey = plan.dayKey;
  const chaos = spec.kind === 'chaos';

  const before = buildLeaderboard(plan, save, input.secretUnlocked);
  const idsAheadBefore = new Set(
    before.standings.slice(0, Math.max(0, before.myRank - 1)).map((s) => s.id),
  );

  const progress = save.challenge(dayKey, spec.id);
  const previousBest = progress.bestScore;
  const previousGameRecord = save.get().records.bestByGame[spec.gameId] ?? 0;
  const previousChaosRecord = save.get().records.bestChaos;
  const score = result.score;

  save.update((data) => {
    const p = save.challenge(dayKey, spec.id);
    p.plays++;
    p.lastScore = score;
    p.history.push(score);
    if (p.history.length > 20) p.history.shift();
    // Solo la mejor de los intentos cuenta.
    if (score > p.bestScore) p.bestScore = score;

    if (chaos) {
      if (score > data.records.bestChaos) data.records.bestChaos = score;
    } else if (score > (data.records.bestByGame[spec.gameId] ?? 0)) {
      data.records.bestByGame[spec.gameId] = score;
    }
  });

  const after = buildLeaderboard(plan, save, input.secretUnlocked);
  const overtook = after.standings
    .slice(after.myRank)
    .filter((s) => idsAheadBefore.has(s.id));

  const isDailyTotalRecord = after.me.total > save.get().records.bestDailyTotal;
  if (isDailyTotalRecord) {
    save.update((data) => {
      data.records.bestDailyTotal = after.me.total;
    });
  }

  const perChallenge = challengeStandings(plan, save, spec);

  return {
    challengeId: spec.id,
    score,
    previousBest,
    isChallengeBest: score > previousBest,
    isPersonalRecord: chaos ? score > previousChaosRecord : score > previousGameRecord && previousGameRecord > 0,
    gainVsBest: score - previousBest,
    attemptsLeft: attemptsLeft(save, dayKey, spec),
    rankBefore: before.myRank,
    rankAfter: after.myRank,
    overtook,
    becameLeader: after.myRank === 1 && before.myRank !== 1,
    target: chaos ? null : rivalAhead(after.standings),
    challengeTarget: rivalAhead(perChallenge),
    challengeRank: rankOf(perChallenge, 'me'),
    dailyTotal: after.me.total,
    isDailyTotalRecord,
    ghostPassed: input.ghostPassed ?? false,
    chaos,
  };
}

/** Titular de la pantalla de resultado. */
export function headlineFor(outcome: ScoreOutcome): { title: string; tone: 'record' | 'good' | 'neutral' } {
  if (outcome.isPersonalRecord) return { title: 'RECORD PERSONAL', tone: 'record' };
  if (outcome.isChallengeBest && outcome.previousBest > 0) return { title: 'NUEVO RECORD', tone: 'record' };
  if (outcome.overtook.length > 0) return { title: `HAS SUPERADO A ${outcome.overtook[0]?.name}`, tone: 'good' };
  if (outcome.isChallengeBest) return { title: 'MARCA REGISTRADA', tone: 'good' };
  return { title: 'NO HAS MEJORADO', tone: 'neutral' };
}
