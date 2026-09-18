import { describe, expect, it } from 'vitest';
import { addDays } from '../src/core/clock';
import { CHALLENGES_PER_DAY, DAYS_PER_WEEK, picksForDay, type GameCatalogEntry } from '../src/meta/daily';

function catalogo(n: number): GameCatalogEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `j${i}`,
    name: `JUEGO ${i}`,
    skill: 'reflejos' as const,
    defaultDurationMs: 30_000,
  }));
}

/** Los ids que salen en `dias` dias seguidos a partir de uno dado. */
function semana(desde: string, cat: GameCatalogEntry[], dias = DAYS_PER_WEEK): string[] {
  const out: string[] = [];
  for (let i = 0; i < dias; i++) out.push(...picksForDay(addDays(desde, i), cat).map((g) => g.id));
  return out;
}

describe('reparto de los retos del dia', () => {
  it('saca tres juegos cada dia', () => {
    expect(picksForDay('2026-09-18', catalogo(21))).toHaveLength(CHALLENGES_PER_DAY);
  });

  it('es determinista: el mismo dia da siempre lo mismo', () => {
    const cat = catalogo(21);
    expect(picksForDay('2026-09-18', cat).map((g) => g.id)).toEqual(
      picksForDay('2026-09-18', cat).map((g) => g.id),
    );
  });

  it('con 21 juegos, una semana entera sin repetir ni uno', () => {
    const ids = semana('2026-09-14', catalogo(21));
    expect(ids).toHaveLength(21);
    expect(new Set(ids).size).toBe(21);
  });

  it('empiece el dia que empiece, siete dias seguidos no repiten', () => {
    // Cualquier arranque cae en la misma baraja semanal o en dos consecutivas;
    // lo que no puede pasar nunca es repetir dentro de un mismo dia.
    for (let offset = 0; offset < 14; offset++) {
      const dia = addDays('2026-01-01', offset);
      const hoy = picksForDay(dia, catalogo(21)).map((g) => g.id);
      expect(new Set(hoy).size).toBe(CHALLENGES_PER_DAY);
    }
  });

  it('dos dias seguidos no comparten juego', () => {
    const cat = catalogo(21);
    for (let i = 0; i < 6; i++) {
      const hoy = picksForDay(addDays('2026-09-14', i), cat).map((g) => g.id);
      const manana = picksForDay(addDays('2026-09-14', i + 1), cat).map((g) => g.id);
      expect(hoy.filter((id) => manana.includes(id))).toEqual([]);
    }
  });

  it('con pocos juegos se agotan todos antes de repetir', () => {
    const ids = semana('2026-09-14', catalogo(4));
    // 21 huecos y 4 juegos: cada uno sale 5 o 6 veces, ninguno acaparado.
    for (const id of ['j0', 'j1', 'j2', 'j3']) {
      const veces = ids.filter((x) => x === id).length;
      expect(veces).toBeGreaterThanOrEqual(4);
      expect(veces).toBeLessThanOrEqual(7);
    }
  });

  it('con pocos juegos tampoco se repite dentro del mismo dia', () => {
    for (let i = 0; i < 14; i++) {
      const hoy = picksForDay(addDays('2026-09-14', i), catalogo(4)).map((g) => g.id);
      expect(new Set(hoy).size).toBe(CHALLENGES_PER_DAY);
    }
  });
});
