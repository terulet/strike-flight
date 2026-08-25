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
  /**
   * Cuantos hacen falta para abrirlo.
   *
   * En grupos pequenos coincide con la gente activa; en grandes se queda en el
   * umbral. Es un campo aparte y no "todos los activos" porque en un grupo de
   * veinticinco decir "faltan 22" desanima, y ademas seria mentira: no hacen
   * falta 22, hacen falta los que queden hasta el umbral.
   */
  total: number;
  missing: string[];
  meDone: boolean;
}

/** Cuantos nombres de los que faltan se dicen antes de resumir. */
export const MAX_NOMBRES_QUE_FALTAN = 3;

/**
 * "MARC", "MARC y KALI", "MARC, KALI y 4 mas".
 *
 * Con veinticinco personas la lista entera es un muro de texto donde antes
 * habia una frase. Se dicen los tres primeros y se cuenta el resto.
 */
export function resumirQueFaltan(nombres: string[], maximo = MAX_NOMBRES_QUE_FALTAN): string {
  if (nombres.length === 0) return '';
  if (nombres.length <= maximo) {
    if (nombres.length === 1) return nombres[0] as string;
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  }
  const restantes = nombres.length - maximo;
  return `${nombres.slice(0, maximo).join(', ')} y ${restantes} mas`;
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
