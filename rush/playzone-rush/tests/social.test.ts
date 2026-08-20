/**
 * Deteccion de adelantamientos: la pieza que decide cuando aparece
 * "MARC TE HA QUITADO EL #1". Falsos positivos = spam; falsos negativos =
 * el producto no existe.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bestRevengeAgainst, detectOvertakes, markOvertakesSeen, rememberTotals } from '../src/meta/social';
import type { Standing } from '../src/meta/ranking';
import { DAY, ensureGames, freshSave } from './helpers';

beforeAll(ensureGames);

const standing = (id: string, name: string, total: number, isMe = false): Standing => ({
  id,
  name,
  color: '#fff',
  isMe,
  total,
  perChallenge: {},
  played: true,
});

describe('adelantamientos', () => {
  it('no avisa la primera vez que ve el ranking', () => {
    const events = detectOvertakes({
      dayKey: DAY,
      standings: [standing('marc', 'Marc', 6000), standing('me', 'Eloi', 5000, true)],
      previous: undefined,
      seen: [],
    });
    expect(events).toHaveLength(0);
  });

  it('avisa cuando alguien que iba por detras te pasa', () => {
    const events = detectOvertakes({
      dayKey: DAY,
      standings: [standing('marc', 'Marc', 6350, false), standing('me', 'Eloi', 6200, true)],
      previous: { me: 6200, marc: 5100 },
      seen: [],
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.rivalName).toBe('Marc');
    expect(events[0]?.gap).toBe(150);
  });

  it('no avisa de quien ya estaba por delante', () => {
    const events = detectOvertakes({
      dayKey: DAY,
      standings: [standing('marc', 'Marc', 9000), standing('me', 'Eloi', 6200, true)],
      previous: { me: 6200, marc: 8000 },
      seen: [],
    });
    expect(events).toHaveLength(0);
  });

  it('no repite el mismo aviso al recargar', () => {
    const input = {
      dayKey: DAY,
      standings: [standing('marc', 'Marc', 6350), standing('me', 'Eloi', 6200, true)],
      previous: { me: 6200, marc: 5100 },
      seen: [] as string[],
    };
    const first = detectOvertakes(input);
    expect(first).toHaveLength(1);
    const second = detectOvertakes({ ...input, seen: [first[0]!.key] });
    expect(second).toHaveLength(0);
  });

  it('vuelve a avisar si el rival mejora otra vez', () => {
    const seen = ['2026-08-18:marc:6350'];
    const events = detectOvertakes({
      dayKey: DAY,
      standings: [standing('marc', 'Marc', 7000), standing('me', 'Eloi', 6200, true)],
      previous: { me: 6200, marc: 5100 },
      seen,
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.theirTotal).toBe(7000);
  });

  it('ignora a jugadores que no habiamos visto todavia', () => {
    const events = detectOvertakes({
      dayKey: DAY,
      standings: [standing('nuevo', 'Kali', 9000), standing('me', 'Eloi', 6200, true)],
      previous: { me: 6200 },
      seen: [],
    });
    expect(events).toHaveLength(0);
  });

  it('ordena por cercania: primero el que tengo mas a tiro', () => {
    const events = detectOvertakes({
      dayKey: DAY,
      standings: [
        standing('kali', 'Kali', 9000),
        standing('marc', 'Marc', 6300),
        standing('me', 'Eloi', 6200, true),
      ],
      previous: { me: 6200, marc: 5000, kali: 5500 },
      seen: [],
    });
    expect(events.map((e) => e.rivalName)).toEqual(['Marc', 'Kali']);
  });

  it('recuerda los totales del dia y no guarda historia infinita', () => {
    const save = freshSave();
    for (let i = 0; i < 12; i++) {
      rememberTotals(save, `2026-08-${String(i + 1).padStart(2, '0')}`, [
        standing('marc', 'Marc', 100 + i),
        standing('me', 'Eloi', 200 + i, true),
      ]);
    }
    const days = Object.keys(save.get().social.lastTotals);
    expect(days.length).toBeLessThanOrEqual(7);
    const last = save.get().social.lastTotals['2026-08-12'];
    expect(last?.me).toBe(211);
    expect(last?.marc).toBe(111);
  });

  it('marca los avisos como vistos sin duplicar', () => {
    const save = freshSave();
    markOvertakesSeen(save, ['a', 'b']);
    markOvertakesSeen(save, ['b', 'c']);
    expect(save.get().social.seenOvertakes).toEqual(['a', 'b', 'c']);
  });
});

describe('a que reto responder', () => {
  const scores: Record<string, Record<string, number>> = {
    me: { c1: 5000, c2: 3000, c3: 1000 },
    marc: { c1: 5100, c2: 6000, c3: 900 },
  };
  const scoreOf = (playerId: string, challengeId: string) => scores[playerId]?.[challengeId] ?? 0;

  it('elige donde el rival esta mas cerca', () => {
    const target = bestRevengeAgainst('marc', ['c1', 'c2', 'c3'], scoreOf, () => true, 'Marc');
    expect(target?.challengeId).toBe('c1');
    expect(target?.gap).toBe(100);
  });

  it('descarta los retos sin intentos', () => {
    const target = bestRevengeAgainst('marc', ['c1', 'c2', 'c3'], scoreOf, (id) => id !== 'c1', 'Marc');
    expect(target?.challengeId).toBe('c2');
    expect(target?.gap).toBe(3000);
  });

  it('devuelve null si ya le gano en todos', () => {
    const target = bestRevengeAgainst('marc', ['c3'], scoreOf, () => true, 'Marc');
    expect(target).toBeNull();
  });
});
