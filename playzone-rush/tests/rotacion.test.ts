/**
 * La rotacion tiene una promesa concreta que se puede comprobar, y este
 * fichero la comprueba: con el catalogo de 12, ningun juego sale dos dias
 * seguidos y ninguno se pierde mas de una semana.
 *
 * No es una promesa decorativa. La queja de la primera semana fue literalmente
 * "los juegos son siempre los mismos", y con 4 juegos barajando de cero el 99
 * de 399 dias eran identicos al anterior. Si alguien afloja esto sin querer,
 * que se entere aqui y no en el grupo de WhatsApp.
 */
import { describe, it, expect } from 'vitest';
import { juegosDelDia, indiceDeDia, POR_DIA } from '../src/meta/rotacion';
import { registerAllGames, GAME_IDS } from '../src/games/index';

registerAllGames();

function catalogo(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `g${i}`);
}

/** Dias consecutivos de verdad, cruzando meses y anios bisiestos. */
function dias(desde: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${desde}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10) as string);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe('indiceDeDia', () => {
  it('avanza de uno en uno, tambien al cambiar de mes y de anio', () => {
    expect(indiceDeDia('2027-03-02') - indiceDeDia('2027-03-01')).toBe(1);
    expect(indiceDeDia('2027-01-01') - indiceDeDia('2026-12-31')).toBe(1);
    expect(indiceDeDia('2028-03-01') - indiceDeDia('2028-02-29')).toBe(1); // bisiesto
  });

  it('rechaza una clave que no es una fecha', () => {
    expect(() => indiceDeDia('manana')).toThrow();
  });
});

describe('juegosDelDia', () => {
  it('es pura: el mismo dia da siempre el mismo reparto', () => {
    const cat = catalogo(12);
    expect(juegosDelDia('2026-09-14', cat)).toEqual(juegosDelDia('2026-09-14', cat));
  });

  it('da exactamente 3 y sin repetir dentro del mismo dia', () => {
    const cat = catalogo(12);
    for (const k of dias('2026-09-01', 500)) {
      const hoy = juegosDelDia(k, cat);
      expect(hoy).toHaveLength(POR_DIA);
      expect(new Set(hoy).size).toBe(POR_DIA);
    }
  });

  it('con 12 juegos NUNCA repite ninguno del dia anterior', () => {
    const cat = catalogo(12);
    const ks = dias('2026-09-01', 1000);
    let choques = 0;
    for (let i = 1; i < ks.length; i++) {
      const ayer = new Set(juegosDelDia(ks[i - 1] as string, cat));
      for (const g of juegosDelDia(ks[i] as string, cat)) if (ayer.has(g)) choques++;
    }
    expect(choques).toBe(0);
  });

  it('reparte: cada juego sale una vez por vuelta y no espera mas de 7 dias', () => {
    const cat = catalogo(12);
    const ks = dias('2026-09-01', 1000);
    const planes = ks.map((k) => juegosDelDia(k, cat));

    for (const g of cat) {
      let ultimo = -1;
      for (let i = 0; i < planes.length; i++) {
        if (!(planes[i] as string[]).includes(g)) continue;
        if (ultimo >= 0) expect(i - ultimo).toBeLessThanOrEqual(7);
        ultimo = i;
      }
      expect(ultimo).toBeGreaterThanOrEqual(0); // ninguno se queda sin salir nunca
    }
  });

  it('no se cae con un catalogo mas corto que un dia', () => {
    expect(juegosDelDia('2026-09-14', ['a'])).toEqual(['a', 'a', 'a']);
    expect(() => juegosDelDia('2026-09-14', [])).toThrow(/catalogo vacio/);
  });

  it('el catalogo de verdad tiene 12 juegos, que es lo que hace que la promesa se cumpla', () => {
    expect(GAME_IDS).toHaveLength(12);
    expect(new Set(GAME_IDS).size).toBe(12);
  });
});
