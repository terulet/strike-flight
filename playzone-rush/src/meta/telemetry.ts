/**
 * Telemetria de producto.
 *
 * No es analitica de marketing: son las cuatro preguntas que deciden si este
 * juego tiene sentido. La principal es el Revenge Rate (cuantas veces que se
 * ofrece una revancha se pulsa de verdad).
 *
 * Todo se guarda en local; si hay grupo, ademas se manda al servidor para
 * poder mirar el grupo entero. No se guarda nada personal: id aleatorio,
 * tipo de evento y numeros.
 */
import { TELEMETRY_LIMIT, type SaveManager, type TelemetryEvent } from '../core/save';

export type EventType =
  | 'app_open'
  | 'group_created'
  | 'group_joined'
  | 'game_start'
  | 'game_finish'
  | 'game_abandon'
  | 'result_seen'
  | 'revenge_available'
  | 'revenge_clicked'
  | 'score_improved'
  | 'rival_overtaken'
  | 'player_was_overtaken'
  | 'daily_all_games_completed'
  | 'secret_unlocked'
  | 'sync_dropped'
  | 'app_update_applied'
  // DOBLE O NADA: se miran juntos. Cuantos se atreven, cuantos lo clavan, y
  // sobre todo si la gente la usa: una ficha que nadie gasta es una ficha mal
  // disenada.
  | 'bet_offered'
  | 'bet_taken'
  | 'bet_won'
  | 'bet_lost'
  // Compartir: no habia NADA de esto. "Cuanto se comparte" es la senal mas
  // fuerte de que un momento vale la pena -mas que la revancha, que solo dice
  // "quiero otra"; compartir dice "esto me representa delante de otros"-, y
  // sin embargo compartirMomento() no avisaba a nadie de como habia ido.
  // Dos eventos, como revenge_available/revenge_clicked: 'attempted' es que
  // se ha pulsado el boton y el flujo ha llegado a una conclusion (incluye
  // cancelar el menu del sistema, que sigue siendo una intencion de
  // compartir); 'completed' es que ha salido algo de verdad (imagen, texto,
  // descarga o portapapeles).
  | 'share_attempted'
  | 'share_completed';

export interface TrackOptions {
  gameId?: string | null;
  value?: number | null;
  meta?: Record<string, unknown> | null;
}

/** Tramos de "por cuanto he perdido" para ver cuando pica mas la revancha. */
export const LOSS_BUCKETS = [
  { id: '0-100', min: 0, max: 100 },
  { id: '100-300', min: 100, max: 300 },
  { id: '300-1000', min: 300, max: 1000 },
  { id: '1000+', min: 1000, max: Infinity },
];

export interface BucketMetric {
  id: string;
  available: number;
  clicked: number;
  rate: number | null;
}

export interface Metrics {
  sessions: number;
  gamesStarted: number;
  gamesFinished: number;
  gamesAbandoned: number;
  revengeAvailable: number;
  revengeClicked: number;
  revengeRate: number | null;
  attemptsUsed: number;
  attemptsAvailable: number;
  attemptUtilization: number | null;
  daysPlayed: number;
  daysCompleted: number;
  dailyCompletion: number | null;
  scoreImproved: number;
  rivalsOvertaken: number;
  timesOvertaken: number;
  secretUnlocks: number;
  nextDayReturns: number;
  nextDayReturnRate: number | null;
  /** Mediana de ms entre "me han superado" y la siguiente partida. */
  socialReactionMs: number | null;
  lossBuckets: BucketMetric[];
  recent: TelemetryEvent[];
}

export class Telemetry {
  private save: SaveManager;
  private dayOf: () => string;
  private sender: ((events: TelemetryEvent[]) => Promise<boolean>) | null;
  private sendTimer: ReturnType<typeof setTimeout> | null = null;
  private versionOf: (gameId: string) => number;
  private testFlag: () => boolean;

  constructor(
    save: SaveManager,
    options: {
      day: () => string;
      send?: (events: TelemetryEvent[]) => Promise<boolean>;
      /** De que version es un juego ahora mismo. Sin esto, todo se guarda como v1. */
      gameVersion?: (gameId: string) => number;
      /** Si el envio actual viene de ?debug (o de una herramienta de verificacion). */
      isTest?: () => boolean;
    },
  ) {
    this.save = save;
    this.dayOf = options.day;
    this.sender = options.send ?? null;
    this.versionOf = options.gameVersion ?? (() => 1);
    this.testFlag = options.isTest ?? (() => false);
  }

  track(type: EventType, options: TrackOptions = {}): void {
    const event: TelemetryEvent = {
      type,
      ts: Date.now(),
      day: this.dayOf(),
      gameId: options.gameId ?? null,
      gameVersion: options.gameId ? this.versionOf(options.gameId) : null,
      value: options.value ?? null,
      meta: options.meta ?? null,
      isTest: this.testFlag(),
    };
    this.save.update((data) => {
      data.telemetry.events.push(event);
      if (data.telemetry.events.length > TELEMETRY_LIMIT) {
        const excess = data.telemetry.events.length - TELEMETRY_LIMIT;
        data.telemetry.events.splice(0, excess);
        data.telemetry.sent = Math.max(0, data.telemetry.sent - excess);
      }
      data.telemetry.counters[type] = (data.telemetry.counters[type] ?? 0) + 1;
    });
    this.scheduleSend();
  }

  /** Envio agrupado: no queremos una peticion por evento. */
  private scheduleSend(): void {
    if (!this.sender || this.sendTimer !== null) return;
    this.sendTimer = setTimeout(() => {
      this.sendTimer = null;
      void this.flush();
    }, 4000);
  }

  async flush(): Promise<void> {
    if (!this.sender) return;
    const state = this.save.get().telemetry;
    const pending = state.events.slice(state.sent);
    if (pending.length === 0) return;
    const ok = await this.sender(pending);
    if (!ok) return;
    this.save.update((data) => {
      data.telemetry.sent = data.telemetry.events.length;
    });
  }

  events(): TelemetryEvent[] {
    return this.save.get().telemetry.events;
  }

  metrics(): Metrics {
    return computeMetrics(this.save);
  }

  exportJson(): string {
    return JSON.stringify(
      { exportedAt: Date.now(), metrics: this.metrics(), events: this.events() },
      null,
      2,
    );
  }

  clear(): void {
    this.save.update((data) => {
      data.telemetry = { events: [], counters: {}, sent: 0 };
    });
    this.save.flush();
  }
}

/* -------------------------------------------------------------------- */
/* Calculo                                                               */
/* -------------------------------------------------------------------- */

export function computeMetrics(save: SaveManager): Metrics {
  const data = save.get();
  const events = data.telemetry.events;
  const counters = data.telemetry.counters;
  const count = (type: EventType) => counters[type] ?? 0;

  // Intentos: se leen del save, que es la verdad de lo jugado.
  let attemptsUsed = 0;
  let attemptsAvailable = 0;
  let daysCompleted = 0;
  const daysPlayed = Object.keys(data.days).filter((day) => {
    const record = data.days[day];
    if (!record) return false;
    const challenges = Object.entries(record.challenges);
    const played = challenges.filter(([, progress]) => progress.plays > 0);
    if (played.length === 0) return false;
    for (const [id, progress] of challenges) {
      const limit = id === 'secret' || id === 'chaos' ? 1 : 3;
      attemptsUsed += Math.min(progress.attemptsUsed, limit);
      attemptsAvailable += limit;
    }
    const daily = ['c1', 'c2', 'c3'];
    if (daily.every((id) => (record.challenges[id]?.plays ?? 0) > 0)) daysCompleted++;
    return true;
  }).length;

  // Reaccion social: de "me han superado" a la siguiente partida.
  const reactions: number[] = [];
  for (let i = 0; i < events.length; i++) {
    if (events[i]?.type !== 'player_was_overtaken') continue;
    const from = events[i]?.ts ?? 0;
    for (let j = i + 1; j < events.length; j++) {
      const next = events[j];
      if (!next) break;
      if (next.type === 'game_start') {
        reactions.push(next.ts - from);
        break;
      }
    }
  }

  // Vuelta al dia siguiente: dias con app_open consecutivos.
  const openDays = Array.from(
    new Set(events.filter((event) => event.type === 'app_open').map((event) => event.day)),
  )
    .filter(Boolean)
    .sort();
  let nextDayReturns = 0;
  for (let i = 1; i < openDays.length; i++) {
    const previous = Date.parse(`${openDays[i - 1]}T12:00:00Z`);
    const current = Date.parse(`${openDays[i]}T12:00:00Z`);
    if (Math.round((current - previous) / 86_400_000) === 1) nextDayReturns++;
  }

  const available = count('revenge_available');
  const clicked = count('revenge_clicked');

  return {
    sessions: count('app_open'),
    gamesStarted: count('game_start'),
    gamesFinished: count('game_finish'),
    gamesAbandoned: count('game_abandon'),
    revengeAvailable: available,
    revengeClicked: clicked,
    revengeRate: available > 0 ? clicked / available : null,
    attemptsUsed,
    attemptsAvailable,
    attemptUtilization: attemptsAvailable > 0 ? attemptsUsed / attemptsAvailable : null,
    daysPlayed,
    daysCompleted,
    dailyCompletion: daysPlayed > 0 ? daysCompleted / daysPlayed : null,
    scoreImproved: count('score_improved'),
    rivalsOvertaken: count('rival_overtaken'),
    timesOvertaken: count('player_was_overtaken'),
    secretUnlocks: count('secret_unlocked'),
    nextDayReturns,
    nextDayReturnRate: openDays.length > 1 ? nextDayReturns / (openDays.length - 1) : null,
    socialReactionMs: median(reactions),
    lossBuckets: lossBuckets(events),
    recent: events.slice(-40).reverse(),
  };
}

function lossBuckets(events: TelemetryEvent[]): BucketMetric[] {
  return LOSS_BUCKETS.map((bucket) => {
    const inBucket = (event: TelemetryEvent) =>
      typeof event.value === 'number' && event.value >= bucket.min && event.value < bucket.max;
    const available = events.filter((e) => e.type === 'revenge_available' && inBucket(e)).length;
    const clicked = events.filter((e) => e.type === 'revenge_clicked' && inBucket(e)).length;
    return {
      id: bucket.id,
      available,
      clicked,
      rate: available > 0 ? clicked / available : null,
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
}
