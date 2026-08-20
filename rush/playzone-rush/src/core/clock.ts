/**
 * "Dia de PLAYZONE".
 *
 * Todo el meta-juego gira alrededor de una clave de dia (YYYY-MM-DD) en hora
 * local. Para desarrollo existe un desplazamiento en dias guardado en el save,
 * asi se puede viajar al futuro/pasado desde el panel de debug sin tocar el
 * reloj del ordenador.
 */
export const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function dayKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map((v) => Number.parseInt(v, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function addDays(key: string, delta: number): string {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + delta);
  return dayKeyFromDate(date);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDayKey(b).getTime() - parseDayKey(a).getTime()) / DAY_MS);
}

/** Etiqueta corta para la UI: "HOY", "AYER" o "LUN 18 AGO". */
export function dayLabel(key: string, todayKey: string): string {
  const diff = daysBetween(todayKey, key);
  if (diff === 0) return 'HOY';
  if (diff === -1) return 'AYER';
  if (diff === 1) return 'MANANA';
  const date = parseDayKey(key);
  const dias = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${dias[date.getDay()]} ${date.getDate()} ${meses[date.getMonth()]}`;
}

export interface ClockOptions {
  /** Fuente de la fecha real. Inyectable para los tests. */
  now?: () => Date;
  getOffset: () => number;
  setOffset: (offset: number) => void;
}

export class GameClock {
  private nowFn: () => Date;
  private getOffset: () => number;
  private setOffsetFn: (offset: number) => void;

  constructor(options: ClockOptions) {
    this.nowFn = options.now ?? (() => new Date());
    this.getOffset = options.getOffset;
    this.setOffsetFn = options.setOffset;
  }

  /** Dia real, sin desplazamiento. */
  realDayKey(): string {
    return dayKeyFromDate(this.nowFn());
  }

  /** Dia virtual: el que ve el juego. */
  todayKey(): string {
    return addDays(this.realDayKey(), this.getOffset());
  }

  get offset(): number {
    return this.getOffset();
  }

  shift(delta: number): string {
    this.setOffsetFn(this.getOffset() + delta);
    return this.todayKey();
  }

  reset(): string {
    this.setOffsetFn(0);
    return this.todayKey();
  }

  /** Milisegundos que faltan para el proximo dia virtual. */
  msUntilNextDay(): number {
    const now = this.nowFn();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return next.getTime() - now.getTime();
  }
}
