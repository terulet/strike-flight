/**
 * Metricas de producto. La principal es el Revenge Rate: si esta mal calculado,
 * tomaremos decisiones con datos falsos, que es peor que no tener datos.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Telemetry, computeMetrics, formatPercent } from '../src/meta/telemetry';
import { TELEMETRY_LIMIT } from '../src/core/save';
import { DAY, ensureGames, freshSave } from './helpers';

beforeAll(ensureGames);

function telemetryFor(save = freshSave(), day = DAY) {
  return new Telemetry(save, { day: () => day });
}

describe('telemetria', () => {
  it('guarda eventos con dia, juego y valor', () => {
    const save = freshSave();
    const telemetry = telemetryFor(save);
    telemetry.track('game_start', { gameId: 'pulse' });
    telemetry.track('game_finish', { gameId: 'pulse', value: 6200 });

    const events = telemetry.events();
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ type: 'game_finish', gameId: 'pulse', value: 6200, day: DAY });
    expect(save.get().telemetry.counters.game_start).toBe(1);
  });

  it('calcula el Revenge Rate como pulsadas entre ofrecidas', () => {
    const save = freshSave();
    const telemetry = telemetryFor(save);
    telemetry.track('revenge_available', { value: 150 });
    telemetry.track('revenge_available', { value: 900 });
    telemetry.track('revenge_available', { value: 2000 });
    telemetry.track('revenge_clicked', { value: 150 });

    const metrics = telemetry.metrics();
    expect(metrics.revengeAvailable).toBe(3);
    expect(metrics.revengeClicked).toBe(1);
    expect(metrics.revengeRate).toBeCloseTo(1 / 3);
  });

  it('sin ofertas, el Revenge Rate es null y no 0', () => {
    // Importa la diferencia: "no lo sabemos" no es lo mismo que "nadie pulsa".
    expect(telemetryFor().metrics().revengeRate).toBeNull();
    expect(formatPercent(null)).toBe('—');
  });

  it('reparte las revanchas por tramo de diferencia', () => {
    const telemetry = telemetryFor();
    telemetry.track('revenge_available', { value: 50 });
    telemetry.track('revenge_clicked', { value: 50 });
    telemetry.track('revenge_available', { value: 250 });
    telemetry.track('revenge_available', { value: 5000 });

    const buckets = telemetry.metrics().lossBuckets;
    expect(buckets.find((b) => b.id === '0-100')?.rate).toBe(1);
    expect(buckets.find((b) => b.id === '100-300')?.rate).toBe(0);
    expect(buckets.find((b) => b.id === '1000+')?.available).toBe(1);
    expect(buckets.find((b) => b.id === '300-1000')?.rate).toBeNull();
  });

  it('mide la utilizacion de intentos con lo realmente jugado', () => {
    const save = freshSave();
    save.update(() => {
      const c1 = save.challenge(DAY, 'c1');
      c1.attemptsUsed = 3;
      c1.plays = 3;
      const c2 = save.challenge(DAY, 'c2');
      c2.attemptsUsed = 1;
      c2.plays = 1;
    });
    const metrics = computeMetrics(save);
    expect(metrics.attemptsUsed).toBe(4);
    expect(metrics.attemptsAvailable).toBe(6);
    expect(metrics.attemptUtilization).toBeCloseTo(4 / 6);
  });

  it('cuenta los dias completos sobre los dias jugados', () => {
    const save = freshSave();
    save.update(() => {
      for (const id of ['c1', 'c2', 'c3']) {
        const progress = save.challenge(DAY, id);
        progress.plays = 1;
        progress.attemptsUsed = 1;
      }
      const otro = save.challenge('2026-08-17', 'c1');
      otro.plays = 1;
      otro.attemptsUsed = 1;
    });
    const metrics = computeMetrics(save);
    expect(metrics.daysPlayed).toBe(2);
    expect(metrics.daysCompleted).toBe(1);
    expect(metrics.dailyCompletion).toBeCloseTo(0.5);
  });

  it('mide cuanto se tarda en responder a un adelantamiento', () => {
    const save = freshSave();
    const telemetry = telemetryFor(save);
    const base = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(base);
    telemetry.track('player_was_overtaken', { value: 150 });
    vi.spyOn(Date, 'now').mockReturnValue(base + 12_000);
    telemetry.track('game_start', { gameId: 'pulse' });
    vi.restoreAllMocks();

    expect(telemetry.metrics().socialReactionMs).toBe(12_000);
  });

  it('cuenta las vueltas al dia siguiente', () => {
    const save = freshSave();
    const telemetry = new Telemetry(save, { day: () => '2026-08-16' });
    telemetry.track('app_open');
    const telemetry2 = new Telemetry(save, { day: () => '2026-08-17' });
    telemetry2.track('app_open');
    const telemetry3 = new Telemetry(save, { day: () => '2026-08-19' });
    telemetry3.track('app_open');

    const metrics = computeMetrics(save);
    expect(metrics.sessions).toBe(3);
    expect(metrics.nextDayReturns).toBe(1);
    expect(metrics.nextDayReturnRate).toBeCloseTo(0.5);
  });

  it('no crece sin limite', () => {
    const save = freshSave();
    const telemetry = telemetryFor(save);
    for (let i = 0; i < TELEMETRY_LIMIT + 50; i++) telemetry.track('game_start');
    expect(telemetry.events().length).toBe(TELEMETRY_LIMIT);
  });

  it('exporta y borra', () => {
    const save = freshSave();
    const telemetry = telemetryFor(save);
    telemetry.track('app_open');
    const exported = JSON.parse(telemetry.exportJson());
    expect(exported.events).toHaveLength(1);
    expect(exported.metrics.sessions).toBe(1);

    telemetry.clear();
    expect(telemetry.events()).toHaveLength(0);
    expect(telemetry.metrics().sessions).toBe(0);
  });

  it('envia al servidor solo lo que falta por enviar', async () => {
    const save = freshSave();
    const sent: number[] = [];
    const telemetry = new Telemetry(save, {
      day: () => DAY,
      send: async (events) => {
        sent.push(events.length);
        return true;
      },
    });
    telemetry.track('app_open');
    telemetry.track('game_start');
    await telemetry.flush();
    telemetry.track('game_finish');
    await telemetry.flush();
    expect(sent).toEqual([2, 1]);
  });

  it('si el envio falla, no marca los eventos como enviados', async () => {
    const save = freshSave();
    const telemetry = new Telemetry(save, { day: () => DAY, send: async () => false });
    telemetry.track('app_open');
    await telemetry.flush();
    expect(save.get().telemetry.sent).toBe(0);
  });
});
