import { beforeAll, describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../src/meta/daily';
import {
  buildLeaderboard,
  challengeStandings,
  formatScore,
  rankedChallenges,
  rivalAhead,
  rivalBehind,
  rivalTotals,
  repartoDelPodio,
} from '../src/meta/ranking';
import { RIVALS, rivalScore, rivalSurvivalMs } from '../src/meta/rivals';
import { DAY, ensureGames, freshSave } from './helpers';

beforeAll(ensureGames);

function setBest(save: ReturnType<typeof freshSave>, id: string, score: number): void {
  save.update(() => {
    const progress = save.challenge(DAY, id);
    progress.bestScore = score;
    progress.plays = 1;
  });
}

describe('ranking del dia', () => {
  it('las marcas de los rivales son deterministas', () => {
    const plan = buildDailyPlan(DAY);
    const marc = RIVALS[0]!;
    const input = {
      dayKey: DAY,
      challengeId: 'c1',
      gameId: plan.challenges[0]!.gameId,
      skill: plan.challenges[0]!.skill,
      difficulty: plan.challenges[0]!.difficulty,
      scoreMultiplier: 1,
    };
    expect(rivalScore(marc, input)).toBe(rivalScore(marc, input));
    expect(rivalScore(marc, input)).not.toBe(rivalScore(RIVALS[1]!, input));
  });

  it('estoy el ultimo mientras no juegue, y subo al puntuar', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const before = buildLeaderboard(plan, save, false);
    expect(before.me.total).toBe(0);
    expect(before.myRank).toBe(before.standings.length);

    setBest(save, 'c1', 99_999);
    const after = buildLeaderboard(plan, save, false);
    expect(after.myRank).toBe(1);
    expect(after.leader.isMe).toBe(true);
  });

  it('mi total es la suma de mis mejores marcas', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    setBest(save, 'c1', 1000);
    setBest(save, 'c2', 2000);
    setBest(save, 'c3', 500);
    expect(buildLeaderboard(plan, save, false).me.total).toBe(3500);
  });

  it('el reto secreto solo suma cuando esta desbloqueado', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    setBest(save, 'secret', 4000);
    expect(buildLeaderboard(plan, save, false).me.total).toBe(0);
    expect(buildLeaderboard(plan, save, true).me.total).toBe(4000);
    expect(rankedChallenges(plan, false)).toHaveLength(3);
    expect(rankedChallenges(plan, true)).toHaveLength(4);
  });

  it('CHAOS nunca entra en el ranking diario', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    setBest(save, 'chaos', 50_000);
    expect(buildLeaderboard(plan, save, true).me.total).toBe(0);
  });

  it('la clasificacion va de mayor a menor', () => {
    const board = buildLeaderboard(buildDailyPlan(DAY), freshSave(), false);
    const totals = board.standings.map((s) => s.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it('rivalAhead y rivalBehind dan la distancia exacta', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const board = buildLeaderboard(plan, save, false);
    const ahead = rivalAhead(board.standings);
    expect(ahead).not.toBeNull();
    expect(ahead!.gap).toBe(ahead!.entry.total - board.me.total);
    // Voy ultimo: no hay nadie por detras.
    expect(rivalBehind(board.standings)).toBeNull();
  });

  it('el ajuste de debug mueve a un rival', () => {
    const plan = buildDailyPlan(DAY);
    const marc = RIVALS[0]!;
    const base = rivalTotals(plan, marc, false, 0).total;
    const boosted = rivalTotals(plan, marc, false, 500).total;
    expect(boosted - base).toBe(500 * 3);
  });

  it('la clasificacion de un reto concreto tambien me incluye', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    setBest(save, 'c1', 100_000);
    const standings = challengeStandings(plan, save, plan.challenges[0]!);
    expect(standings[0]!.isMe).toBe(true);
    expect(standings).toHaveLength(RIVALS.length + 1);
  });

  it('el fantasma se deriva de la marca del rival', () => {
    const ms = rivalSurvivalMs(3000, 40_000, 'drift');
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(40_000);
    expect(rivalSurvivalMs(99_999, 40_000, 'drift')).toBeLessThanOrEqual(40_000);
    expect(rivalSurvivalMs(0, 40_000, 'drift')).toBeGreaterThan(0);
  });

  it('formatScore agrupa siempre de tres en tres', () => {
    expect(formatScore(8420)).toBe('8.420');
    expect(formatScore(521)).toBe('521');
    expect(formatScore(14590)).toBe('14.590');
    expect(formatScore(1234567)).toBe('1.234.567');
    expect(formatScore(0)).toBe('0');
  });
});

/**
 * El reparto del podio.
 *
 * Vigila la regla que mas facil se rompe sin que nadie se entere: con seis
 * jugadores todo cabe en pantalla y no se nota nada, y con ocho -el maximo de
 * un grupo- alguien se queda sin poder encontrarse.
 */
describe('reparto del podio', () => {
  it('el podio son tres, o menos si no hay tanta gente', () => {
    expect(repartoDelPodio(8, 0).podio).toBe(3);
    expect(repartoDelPodio(2, 0).podio).toBe(2);
    expect(repartoDelPodio(1, 0).podio).toBe(1);
  });

  it('estando en el podio no se repite nada', () => {
    for (const i of [0, 1, 2]) {
      expect(repartoDelPodio(8, i).repetirMiFila, `puesto ${i + 1}`).toBe(false);
    }
  });

  it('con el grupo lleno y fuera del podio, mi fila se repite', () => {
    // Ocho es el maximo de un grupo: cinco filas debajo del podio ya obligan a
    // buscarse, y es justo el caso en el que esto importa.
    expect(repartoDelPodio(8, 7).repetirMiFila).toBe(true);
    expect(repartoDelPodio(8, 3).repetirMiFila).toBe(true);
  });

  it('si cabe todo de un vistazo, no se repite', () => {
    // Seis jugadores: tres en el podio y tres filas. Repetir seria ruido.
    expect(repartoDelPodio(6, 4).repetirMiFila).toBe(false);
    expect(repartoDelPodio(5, 4).repetirMiFila).toBe(false);
  });

  it('sin estar en la lista no se inventa una fila', () => {
    expect(repartoDelPodio(8, -1).repetirMiFila).toBe(false);
  });
});
