import { describe, expect, it } from 'vitest';
import { GameClock, addDays, dayKeyFromDate, dayLabel, daysBetween, parseDayKey } from '../src/core/clock';

describe('dia virtual', () => {
  it('formatea la fecha local como YYYY-MM-DD', () => {
    expect(dayKeyFromDate(new Date(2026, 7, 18, 23, 30))).toBe('2026-08-18');
    expect(dayKeyFromDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  it('suma y resta dias cruzando meses y anos', () => {
    expect(addDays('2026-08-18', 1)).toBe('2026-08-19');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('mide la distancia entre dias', () => {
    expect(daysBetween('2026-08-18', '2026-08-21')).toBe(3);
    expect(daysBetween('2026-08-18', '2026-08-15')).toBe(-3);
  });

  it('parseDayKey devuelve una fecha local del mismo dia', () => {
    const date = parseDayKey('2026-08-18');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(18);
  });

  it('etiqueta HOY, AYER y fechas lejanas', () => {
    expect(dayLabel('2026-08-18', '2026-08-18')).toBe('HOY');
    expect(dayLabel('2026-08-17', '2026-08-18')).toBe('AYER');
    expect(dayLabel('2026-08-10', '2026-08-18')).toMatch(/\d+ AGO/);
  });

  it('el reloj aplica el desplazamiento de debug', () => {
    let offset = 0;
    const clock = new GameClock({
      now: () => new Date(2026, 7, 18, 12, 0),
      getOffset: () => offset,
      setOffset: (value) => {
        offset = value;
      },
    });
    expect(clock.todayKey()).toBe('2026-08-18');
    expect(clock.shift(1)).toBe('2026-08-19');
    expect(clock.shift(1)).toBe('2026-08-20');
    expect(clock.shift(-5)).toBe('2026-08-15');
    expect(clock.realDayKey()).toBe('2026-08-18');
    expect(clock.reset()).toBe('2026-08-18');
    expect(offset).toBe(0);
  });
});
