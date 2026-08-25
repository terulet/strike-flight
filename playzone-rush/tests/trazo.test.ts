/**
 * Figuras de TRAZO.
 *
 * Se comprueba la GEOMETRIA, no solo que salga algo: el rotulo y la forma
 * tienen que corresponderse. Con cuatro lados basta cambiar el giro de salida
 * para que un rombo se dibuje como cuadrado, y eso no lo detecta ninguna
 * prueba de "genera N puntos" — solo se ve mirando la pantalla. Paso: salia un
 * cuadrado perfecto rotulado ROMBO.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generarFigura } from '../src/games/trazo/index';

/** Busca una figura concreta probando semillas: el tipo sale del rng. */
function figuraLlamada(nombre: string, dificultad = 0.9) {
  for (let i = 0; i < 400; i++) {
    const figura = generarFigura(new Rng(`semilla-${i}`), dificultad);
    if (figura.nombre === nombre) return figura;
  }
  throw new Error(`No ha salido ninguna figura "${nombre}" en 400 semillas`);
}

const casi = (a: number, b: number, tol = 0.02) => Math.abs(a - b) < tol;

describe('figuras de TRAZO', () => {
  it('el cuadrado tiene los lados horizontales y verticales', () => {
    const figura = figuraLlamada('CUADRADO');
    const xs = [...new Set(figura.puntos.map((p) => Number(p.x.toFixed(3))))];
    const ys = [...new Set(figura.puntos.map((p) => Number(p.y.toFixed(3))))];
    // Un cuadrado alineado solo usa dos valores distintos de x y dos de y.
    expect(xs).toHaveLength(2);
    expect(ys).toHaveLength(2);
  });

  it('el rombo tiene un vertice arriba, no lados horizontales', () => {
    const figura = figuraLlamada('ROMBO');
    const arriba = figura.puntos.reduce((a, b) => (a.y < b.y ? a : b));
    // Vertice superior centrado: eso es un rombo y no un cuadrado.
    expect(casi(arriba.x, 0.5)).toBe(true);
    const xs = [...new Set(figura.puntos.map((p) => Number(p.x.toFixed(3))))];
    expect(xs.length).toBeGreaterThan(2);
  });

  it('el triangulo tiene tres vertices distintos y punta arriba', () => {
    const figura = figuraLlamada('TRIANGULO');
    const unicos = new Set(figura.puntos.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
    expect(unicos.size).toBe(3); // el ultimo punto cierra sobre el primero
    const arriba = figura.puntos.reduce((a, b) => (a.y < b.y ? a : b));
    expect(casi(arriba.x, 0.5)).toBe(true);
  });

  it('la estrella alterna radio largo y corto', () => {
    const figura = figuraLlamada('ESTRELLA');
    const radios = figura.puntos.map((p) => Math.hypot(p.x - 0.5, p.y - 0.5));
    const pares = radios.filter((_, i) => i % 2 === 0);
    const impares = radios.filter((_, i) => i % 2 === 1);
    const medioPar = pares.reduce((a, b) => a + b, 0) / pares.length;
    const medioImpar = impares.reduce((a, b) => a + b, 0) / impares.length;
    expect(medioPar).toBeGreaterThan(medioImpar * 1.6);
  });

  it('el zigzag alterna arriba y abajo avanzando en horizontal', () => {
    const figura = figuraLlamada('ZIGZAG');
    for (let i = 1; i < figura.puntos.length; i++) {
      const previo = figura.puntos[i - 1]!;
      const actual = figura.puntos[i]!;
      expect(actual.x).toBeGreaterThan(previo.x);
      expect(actual.y).not.toBeCloseTo(previo.y, 2);
    }
  });

  it('la espiral se va abriendo', () => {
    const figura = figuraLlamada('ESPIRAL');
    const radios = figura.puntos.map((p) => Math.hypot(p.x - 0.5, p.y - 0.5));
    expect(radios[radios.length - 1]!).toBeGreaterThan(radios[0]! * 2);
  });

  it('todas las figuras caben en la pantalla', () => {
    for (let i = 0; i < 200; i++) {
      const figura = generarFigura(new Rng(`s${i}`), (i % 10) / 10);
      for (const p of figura.puntos) {
        expect(p.x, figura.nombre).toBeGreaterThanOrEqual(0);
        expect(p.x, figura.nombre).toBeLessThanOrEqual(1);
        expect(p.y, figura.nombre).toBeGreaterThanOrEqual(0);
        expect(p.y, figura.nombre).toBeLessThanOrEqual(1);
      }
    }
  });

  it('con poca dificultad solo salen las formas faciles', () => {
    const nombres = new Set<string>();
    for (let i = 0; i < 200; i++) nombres.add(generarFigura(new Rng(`f${i}`), 0.1).nombre);
    // Espiral y zigzag piden mas pulso: no deben aparecer de entrada.
    expect(nombres.has('ESPIRAL')).toBe(false);
    expect(nombres.has('ZIGZAG')).toBe(false);
  });

  it('la misma semilla da siempre la misma figura', () => {
    const a = generarFigura(new Rng('igual'), 0.6);
    const b = generarFigura(new Rng('igual'), 0.6);
    expect(a.nombre).toBe(b.nombre);
    expect(a.puntos).toEqual(b.puntos);
  });
});
