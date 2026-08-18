/**
 * Traduce un reto del dia (datos de meta) en un GameConfig (datos de juego).
 * Es el punto exacto donde el shell "encarga" una partida al minijuego.
 */
import type { GameConfig, GhostData } from '../game/contract';
import { resolveMutators } from '../game/mutators';
import { requireGame } from '../game/registry';
import type { SaveManager } from '../core/save';
import type { ChallengeSpec, DailyPlan } from './daily';
import { challengeStandings, rivalAhead, type RankingContext, type Standing } from './ranking';
import { getRival, rivalSurvivalMs } from './rivals';

/** El rival a batir en este reto: el que tengo justo delante (o el lider). */
export function targetForChallenge(
  plan: DailyPlan,
  spec: ChallengeSpec,
  save: SaveManager,
  context: RankingContext = {},
): { entry: Standing; gap: number } | null {
  const standings = challengeStandings(plan, save, spec, context);
  const ahead = rivalAhead(standings);
  if (ahead) return ahead;
  // Voy primero: el objetivo pasa a ser el segundo (para no perder la corona).
  const second = standings[1];
  const me = standings[0];
  if (!second || !me) return null;
  return { entry: second, gap: second.total - me.total };
}

export function buildGhost(
  plan: DailyPlan,
  spec: ChallengeSpec,
  save: SaveManager,
  context: RankingContext = {},
): GhostData | null {
  const meta = requireGame(spec.gameId).meta;
  if (!meta.supportsGhost) return null;
  const target = targetForChallenge(plan, spec, save, context);
  if (!target || target.entry.isMe) return null;
  // Con jugadores reales no hay ficha de bot: el nombre sale del ranking.
  const rival = getRival(target.entry.id);
  return {
    rivalId: target.entry.id,
    rivalName: rival?.name ?? target.entry.name,
    kind: 'time',
    value: rivalSurvivalMs(target.entry.total, spec.durationMs, spec.gameId),
    score: target.entry.total,
  };
}

export function buildGameConfig(
  plan: DailyPlan,
  spec: ChallengeSpec,
  save: SaveManager,
  context: RankingContext = {},
): GameConfig {
  const target = targetForChallenge(plan, spec, save, context);
  return {
    seed: spec.seed,
    durationMs: spec.durationMs,
    difficulty: spec.difficulty,
    mutators: resolveMutators(spec.mutatorIds),
    mutatorIds: spec.mutatorIds.slice(),
    ghost: buildGhost(plan, spec, save, context),
    targetScore: target && !target.entry.isMe ? target.entry.total : null,
    targetName: target && !target.entry.isMe ? target.entry.name : null,
  };
}
