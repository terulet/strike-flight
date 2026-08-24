import { beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../src/core/clock';
import {
  DAILY_ATTEMPTS,
  allChallenges,
  buildDailyPlan,
  findChallenge,
  formatDuration,
} from '../src/meta/daily';
import { resolveMutators } from '../src/game/mutators';
import { getGame, requireGame } from '../src/game/registry';
import { DAY, ensureGames } from './helpers';

beforeAll(ensureGames);

describe('rotacion diaria', () => {
  it('el mismo dia produce exactamente el mismo plan', () => {
    const a = buildDailyPlan(DAY);
    const b = buildDailyPlan(DAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('dias distintos producen planes distintos', () => {
    const hoy = buildDailyPlan(DAY);
    const manana = buildDailyPlan(addDays(DAY, 1));
    expect(JSON.stringify(hoy)).not.toBe(JSON.stringify(manana));
  });

  it('hay 3 retos diarios, uno secreto y un evento CHAOS', () => {
    const plan = buildDailyPlan(DAY);
    expect(plan.challenges).toHaveLength(3);
    expect(plan.secret.kind).toBe('secret');
    expect(plan.chaos.kind).toBe('chaos');
    expect(allChallenges(plan)).toHaveLength(5);
  });

  it('los tres retos usan juegos distintos cuando hay catalogo suficiente', () => {
    const plan = buildDailyPlan(DAY);
    const ids = new Set(plan.challenges.map((c) => c.gameId));
    expect(ids.size).toBe(3);
  });

  it('la dificultad sube reto a reto y los mutadores tambien', () => {
    const plan = buildDailyPlan(DAY);
    const [c1, c2, c3] = plan.challenges;
    expect(c1!.difficulty).toBeLessThan(c2!.difficulty);
    expect(c2!.difficulty).toBeLessThan(c3!.difficulty);

    // El primero siempre va limpio, y a partir de ahi se piden mas mutadores.
    // Se comprueban topes y no cantidades exactas a proposito: un juego puede
    // declarar que mutadores admite (RITMO no acepta invertir controles, por
    // ejemplo), asi que el reto puede quedarse con menos de los pedidos. Fijar
    // el numero exacto ataba el test al catalogo de juegos de ese momento.
    expect(c1!.mutatorIds).toHaveLength(0);
    expect(c2!.mutatorIds.length).toBeLessThanOrEqual(1);
    expect(c3!.mutatorIds.length).toBeLessThanOrEqual(2);
    expect(c3!.mutatorIds.length).toBeGreaterThanOrEqual(c2!.mutatorIds.length);
  });

  it('ningun reto recibe un mutador que su juego no admita', () => {
    // La comprobacion que de verdad importa, y que no depende del dia.
    for (const dia of ['2026-08-19', '2026-09-02', '2026-11-30', '2027-01-15']) {
      const plan = buildDailyPlan(dia);
      const retos = [...plan.challenges, plan.secret, plan.chaos];
      for (const reto of retos) {
        const juego = requireGame(reto.gameId);
        const admitidos = juego.meta.supportedMutators;
        if (!admitidos) continue;
        for (const id of reto.mutatorIds) {
          expect(admitidos, `${dia} ${reto.id} ${juego.meta.name}`).toContain(id);
        }
      }
    }
  });

  it('los mutadores del dia no se repiten entre retos', () => {
    for (let i = 0; i < 40; i++) {
      const plan = buildDailyPlan(addDays(DAY, i));
      const all = plan.challenges.flatMap((c) => c.mutatorIds);
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('la duracion refleja el mutador de tiempo', () => {
    for (let i = 0; i < 60; i++) {
      const plan = buildDailyPlan(addDays(DAY, i));
      for (const spec of allChallenges(plan)) {
        const expected = Math.round(spec.baseDurationMs * resolveMutators(spec.mutatorIds).durationMultiplier);
        expect(spec.durationMs).toBe(expected);
      }
    }
  });

  it('intentos: 3 en los diarios, 1 en secreto y CHAOS', () => {
    const plan = buildDailyPlan(DAY);
    for (const spec of plan.challenges) expect(spec.attempts).toBe(DAILY_ATTEMPTS);
    expect(plan.secret.attempts).toBe(1);
    expect(plan.chaos.attempts).toBe(1);
  });

  it('el reto secreto siempre lleva puntos dobles Y una vuelta de tuerca de verdad', () => {
    const plan = buildDailyPlan(DAY);
    expect(plan.secret.mutatorIds).toContain('double');
    expect(plan.secret.scoreMultiplier).toBe(2);
    // Lo que no puede pasar NUNCA es que se quede en solo dobles: eso es un
    // reto normal con mas puntos, no un reto secreto.
    expect(plan.secret.mutatorIds.length).toBeGreaterThan(1);
  });

  it('CHAOS no puntua en el ranking diario', () => {
    const plan = buildDailyPlan(DAY);
    expect(plan.chaos.countsForRanking).toBe(false);
    expect(plan.chaos.mutatorIds).toContain('chaos');
    expect(plan.challenges.every((c) => c.countsForRanking)).toBe(true);
  });

  it('cada reto tiene una semilla propia y estable', () => {
    const plan = buildDailyPlan(DAY);
    const seeds = allChallenges(plan).map((c) => c.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(seeds[0]).toBe(buildDailyPlan(DAY).challenges[0]!.seed);
  });

  it('findChallenge encuentra por id', () => {
    const plan = buildDailyPlan(DAY);
    expect(findChallenge(plan, 'c2')?.id).toBe('c2');
    expect(findChallenge(plan, 'secret')?.kind).toBe('secret');
    expect(findChallenge(plan, 'nope')).toBeNull();
  });

  it('formatDuration da mm:ss', () => {
    expect(formatDuration(30_000)).toBe('00:30');
    expect(formatDuration(40_000)).toBe('00:40');
    expect(formatDuration(21_000)).toBe('00:21');
  });

  it('funciona aunque solo haya un juego en el catalogo', () => {
    const plan = buildDailyPlan(DAY, [
      { id: 'solo', name: 'SOLO', skill: 'reflejos', defaultDurationMs: 20_000 },
    ]);
    expect(plan.challenges).toHaveLength(3);
    expect(plan.challenges.every((c) => c.gameId === 'solo')).toBe(true);
  });
});

/**
 * Un ano entero de dias, no uno.
 *
 * El fallo que motivo estas comprobaciones aparecia un dia de cada veintidos:
 * mirando un dia suelto se pasa, y mirando la app un martes cualquiera tambien.
 */
describe('el reto secreto, un ano seguido', () => {
  const dias: string[] = [];
  {
    const d = new Date('2026-09-01T00:00:00Z');
    for (let i = 0; i < 365; i++) {
      dias.push(d.toISOString().slice(0, 10) as string);
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  it('nunca se queda en solo puntos dobles', () => {
    for (const k of dias) {
      const secret = buildDailyPlan(k).secret;
      expect(secret.mutatorIds.length, `${k}: ${secret.gameId}`).toBeGreaterThan(1);
      expect(secret.mutatorIds, k).toContain('double');
    }
  });

  it('sus mutadores son siempre de los que ese juego entiende', () => {
    for (const k of dias) {
      const plan = buildDailyPlan(k);
      for (const reto of [...plan.challenges, plan.secret, plan.chaos]) {
        const juego = getGame(reto.gameId);
        const soportados = juego?.meta.supportedMutators;
        if (!soportados) continue;
        for (const m of reto.mutatorIds) {
          expect(soportados, `${k} ${reto.id} ${reto.gameId}`).toContain(m);
        }
      }
    }
  });

  it('sale a oscuras la gran mayoria de los dias', () => {
    const aOscuras = dias.filter((k) => buildDailyPlan(k).secret.mutatorIds.includes('blackout'));
    // Solo se renuncia al apagon cuando NINGUNO de los tres juegos del dia
    // puede jugarse a oscuras. Con el catalogo de 12 eso es raro.
    expect(aOscuras.length / dias.length).toBeGreaterThan(0.9);
  });
});
