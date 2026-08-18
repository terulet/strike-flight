/**
 * Intentos.
 *
 * Tres por reto diario, uno para el secreto y uno para el evento CHAOS. El
 * intento se consume AL EMPEZAR (asi no se puede reiniciar cien veces para
 * quedarse solo con la buena), con una devolucion si abandonas en los primeros
 * segundos por error.
 */
import type { SaveManager } from '../core/save';
import type { ChallengeSpec } from './daily';

export const ABORT_REFUND_MS = 3000;

export function attemptsUsed(save: SaveManager, dayKey: string, challengeId: string): number {
  return save.get().days[dayKey]?.challenges[challengeId]?.attemptsUsed ?? 0;
}

export function attemptsLeft(save: SaveManager, dayKey: string, spec: ChallengeSpec): number {
  return Math.max(0, spec.attempts - attemptsUsed(save, dayKey, spec.id));
}

export function canPlay(save: SaveManager, dayKey: string, spec: ChallengeSpec): boolean {
  return attemptsLeft(save, dayKey, spec) > 0;
}

/** Consume un intento. false = no quedaba ninguno. */
export function beginAttempt(save: SaveManager, dayKey: string, spec: ChallengeSpec): boolean {
  if (!canPlay(save, dayKey, spec)) return false;
  save.update((data) => {
    void data;
    const progress = save.challenge(dayKey, spec.id);
    progress.attemptsUsed++;
  });
  return true;
}

/** Devuelve el intento (abandono inmediato). */
export function refundAttempt(save: SaveManager, dayKey: string, spec: ChallengeSpec): void {
  save.update(() => {
    const progress = save.challenge(dayKey, spec.id);
    progress.attemptsUsed = Math.max(0, progress.attemptsUsed - 1);
  });
}

/** Debug: devuelve todos los intentos de un reto (o de todos). */
export function restoreAttempts(save: SaveManager, dayKey: string, challengeId?: string): void {
  save.update(() => {
    const day = save.day(dayKey);
    for (const [id, progress] of Object.entries(day.challenges)) {
      if (challengeId && id !== challengeId) continue;
      progress.attemptsUsed = 0;
    }
  });
}

/** "● ● ○" para la UI. */
export function attemptDots(used: number, total: number): string {
  return Array.from({ length: total }, (_, i) => (i < total - used ? '●' : '○')).join(' ');
}
