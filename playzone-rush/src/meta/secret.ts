/**
 * Reto secreto y evento CHAOS.
 *
 * El secreto se abre cuando TODO el grupo ha jugado los tres retos del dia.
 * Sin backend, la participacion de los rivales se marca desde debug (y en el
 * futuro llegara del servidor sin cambiar nada de esto).
 */
import type { SaveManager } from '../core/save';
import type { DailyPlan } from './daily';
import { RIVALS } from './rivals';

export interface SecretStatus {
  unlocked: boolean;
  /** Miembros del grupo que ya han jugado hoy (yo incluido). */
  done: number;
  total: number;
  missing: string[];
  meDone: boolean;
}

/** He jugado los tres retos del dia. */
export function haveIPlayedAll(save: SaveManager, plan: DailyPlan): boolean {
  const day = save.get().days[plan.dayKey];
  if (!day) return false;
  return plan.challenges.every((spec) => (day.challenges[spec.id]?.plays ?? 0) > 0);
}

export function secretStatus(save: SaveManager, plan: DailyPlan): SecretStatus {
  const day = save.get().days[plan.dayKey];
  const played = new Set(day?.rivalsPlayed ?? []);
  const meDone = haveIPlayedAll(save, plan);
  const missing = RIVALS.filter((r) => !played.has(r.id)).map((r) => r.name);
  if (!meDone) missing.unshift(save.get().profile.name);
  const done = RIVALS.filter((r) => played.has(r.id)).length + (meDone ? 1 : 0);
  return {
    unlocked: Boolean(day?.secretUnlocked),
    done,
    total: RIVALS.length + 1,
    missing,
    meDone,
  };
}

/**
 * Comprueba la condicion y abre el reto si toca.
 * Devuelve true SOLO la primera vez (para poder celebrarlo).
 */
export function evaluateSecretUnlock(save: SaveManager, plan: DailyPlan): boolean {
  const status = secretStatus(save, plan);
  if (status.unlocked) return false;
  if (status.done < status.total) return false;
  save.update(() => {
    save.day(plan.dayKey).secretUnlocked = true;
  });
  return true;
}

export function markRivalPlayed(save: SaveManager, dayKey: string, rivalId: string, played = true): void {
  save.update(() => {
    const day = save.day(dayKey);
    const set = new Set(day.rivalsPlayed);
    if (played) set.add(rivalId);
    else set.delete(rivalId);
    day.rivalsPlayed = Array.from(set);
  });
}

export function markAllRivalsPlayed(save: SaveManager, dayKey: string, played = true): void {
  save.update(() => {
    save.day(dayKey).rivalsPlayed = played ? RIVALS.map((r) => r.id) : [];
  });
}

export function forceSecretUnlock(save: SaveManager, dayKey: string, unlocked = true): void {
  save.update(() => {
    save.day(dayKey).secretUnlocked = unlocked;
  });
}

export function isChaosEnabled(save: SaveManager, dayKey: string): boolean {
  return Boolean(save.get().days[dayKey]?.chaosEnabled);
}

export function setChaosEnabled(save: SaveManager, dayKey: string, enabled: boolean): void {
  save.update(() => {
    save.day(dayKey).chaosEnabled = enabled;
  });
}
