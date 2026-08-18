/**
 * Traduce un reto del dia (datos de meta) en un GameConfig (datos de juego).
 * Es el punto exacto donde el shell "encarga" una partida al minijuego.
 */
import type { GameConfig, GhostData } from '../game/contract';
import { resolveMutators } from '../game/mutators';
import { requireGame } from '../game/registry';
import type { SaveManager } from '../core/save';
import type { ChallengeSpec, DailyPlan } from './daily';
import { challengeStandings, rivalAhead, type Standing } from './ranking';
import { getRival, rivalSurvivalMs } from './rivals';

/** El rival a batir en este reto: el que tengo justo delante (o el lider). */
export function targetForChallenge(
  plan: DailyPlan,
  spec: ChallengeSpec,
  save: SaveManager,
): { entry: Standing; gap: number } | null {
  const standings = challengeStandings(plan, save, spec);
  const ahead = rivalAhead(standings);
  if (ahead) return ahead;
  // Voy primero: el objetivo pasa a ser el segundo (para no perder la corona).
  const second = standings[1];
  const me = standings[0];
  if (!second || !me) return null;
  return { entry: second, gap: second.total - me.total };
}

export function buildGhost(plan: DailyPlan, spec: ChallengeSpec, save: SaveManager): GhostData | null {
  const meta = requireGame(spec.gameId).meta;
  if (!meta.supportsGhost) return null;
  const target = targetForChallenge(plan, spec, save);
  if (!target || target.entry.isMe) return null;
  const rival = getRival(target.entry.id);
  if (!rival) return null;
  return {
    rivalId: rival.id,
    rivalName: rival.name,
    kind: 'time',
    value: rivalSurvivalMs(target.entry.total, spec.durationMs, spec.gameId),
    score: target.entry.total,
  };
}

export function buildGameConfig(plan: DailyPlan, spec: ChallengeSpec, save: SaveManager): GameConfig {
  const target = targetForChallenge(plan, spec, save);
  return {
    seed: spec.seed,
    durationMs: spec.durationMs,
    difficulty: spec.difficulty,
    mutators: resolveMutators(spec.mutatorIds),
    mutatorIds: spec.mutatorIds.slice(),
    ghost: buildGhost(plan, spec, save),
    targetScore: target && !target.entry.isMe ? target.entry.total : null,
    targetName: target && !target.entry.isMe ? target.entry.name : null,
  };
}
