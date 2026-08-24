import { SaveManager } from '../src/core/save';
import { createMemoryStore, type KeyValueStore } from '../src/core/storage';
import { registerAllGames } from '../src/games/index';
import { gameIds } from '../src/game/registry';

/** Registra los juegos reales una sola vez para toda la suite. */
export function ensureGames(): void {
  if (gameIds().length === 0) registerAllGames();
}

export function freshSave(store: KeyValueStore = createMemoryStore()): SaveManager {
  return new SaveManager(store);
}

export const DAY = '2026-08-18';

import type { GameResult } from '../src/game/contract';

export function makeResult(gameId: string, score: number, extra: Partial<GameResult> = {}): GameResult {
  return {
    gameId,
    gameVersion: 1,
    seed: 'test',
    score,
    durationMs: 30_000,
    accuracy: 0.8,
    bestCombo: 5,
    mistakes: 1,
    mutatorIds: [],
    endedBy: 'time',
    metrics: {},
    ...extra,
  };
}
