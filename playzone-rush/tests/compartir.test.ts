/**
 * Que se ofrece compartir y que se cuenta.
 *
 * Es texto e imagen que salen de la app y llegan al chat de otra persona, asi
 * que conviene que este probado. Lo mas importante que vigila este fichero no
 * es lo que ofrece, sino lo que NO ofrece: si el boton sale siempre, deja de
 * significar algo.
 */
import { describe, expect, it } from 'vitest';
import {
  MARGEN_POR_POCO,
  momentoDe,
  textoInvitacion,
  unirNombres,
  type DatosMomento,
} from '../src/meta/compartir';

const BASE: DatosMomento = {
  yo: 'ELOI',
  reto: 'RETO 1',
  juego: 'PULSE',
  color: '#22d3ee',
  puntuacion: 6482,
  adelantados: [],
  lider: false,
  robaLiderato: false,
  record: false,
  mejora: 0,
  racha: 0,
  apuesta: null,
};

describe('cuando se ofrece compartir', () => {
  it('una partida normal no ofrece nada', () => {
    expect(momentoDe(BASE)).toBeNull();
  });

  it('mejorar sin adelantar a nadie tampoco', () => {
    // Subir tu propia marca sin llegar a nadie no le importa a otra persona.
    expect(momentoDe({ ...BASE, mejora: 300 })).toBeNull();
  });

  it('robar el #1 se cuenta, con la diferencia', () => {
    const m = momentoDe({
      ...BASE,
      lider: true,
      robaLiderato: true,
      adelantados: [{ nombre: 'MARC', total: 6350 }],
    });
    expect(m?.tipo).toBe('robo');
    expect(m?.comparativa?.diferencia).toBe('+132');
    expect(m?.comparativa?.etiquetaB).toBe('MARC');
    expect(m?.texto).toContain('132');
  });

  it('ganar por los pelos manda sobre ganar de calle', () => {
    // El margen ES la historia: 18 puntos se cuentan distinto que 900.
    const pelos = momentoDe({ ...BASE, adelantados: [{ nombre: 'MARC', total: 6464 }] });
    expect(pelos?.tipo).toBe('porPoco');
    expect(pelos?.titulo).toBe('POR 18 PUNTOS.');
    expect(pelos?.remate).toBe('ESO HA DOLIDO.');

    const decalle = momentoDe({ ...BASE, adelantados: [{ nombre: 'MARC', total: 3000 }] });
    expect(decalle?.titulo).not.toContain('POR');
  });

  it('el limite de "por poco" es exactamente el margen definido', () => {
    const justo = momentoDe({ ...BASE, adelantados: [{ nombre: 'M', total: BASE.puntuacion - MARGEN_POR_POCO }] });
    const pasado = momentoDe({ ...BASE, adelantados: [{ nombre: 'M', total: BASE.puntuacion - MARGEN_POR_POCO - 1 }] });
    expect(justo?.remate).toBe('ESO HA DOLIDO.');
    expect(pasado?.remate).toBe('TE TOCA.');
  });

  it('la apuesta manda sobre todo lo demas', () => {
    // Jugarsela es lo que mas conversacion genera en un grupo.
    const m = momentoDe({
      ...BASE,
      apuesta: 'doblo',
      apuestaAntes: 814,
      puntuacion: 1628,
      lider: true,
      robaLiderato: true,
      adelantados: [{ nombre: 'MARC', total: 900 }],
      record: true,
    });
    expect(m?.tipo).toBe('doblo');
    expect(m?.comparativa?.cifraA).toBe('1.628');
    expect(m?.comparativa?.cifraB).toBe('814');
  });

  it('perder la apuesta tambien se ofrece', () => {
    // Esconder el fracaso seria perder la mitad de la conversacion.
    const m = momentoDe({ ...BASE, apuesta: 'cayo', apuestaAntes: 814, puntuacion: 407 });
    expect(m?.tipo).toBe('cayo');
    expect(m?.remate).toBe('DOLIÓ.');
    expect(m?.comparativa?.diferencia).toBe('x0,5');
  });

  it('la racha se cuenta a partir de tres dias', () => {
    expect(momentoDe({ ...BASE, racha: 2 })).toBeNull();
    const m = momentoDe({ ...BASE, racha: 5 });
    expect(m?.tipo).toBe('racha');
    expect(m?.cifra).toBe('5');
  });

  it('el fantasma vale jugando solo, sin rival humano', () => {
    // Modo PROBAR SOLO: no hay grupo ni servidor y aun asi hay algo que contar.
    const m = momentoDe({ ...BASE, ghostSuperado: true, ghostRival: 'MARC' });
    expect(m?.tipo).toBe('ghost');
    expect(m?.comparativa?.etiquetaB).toContain('MARC');
  });

  it('el fantasma sin nombre de rival no rompe el poster', () => {
    const m = momentoDe({ ...BASE, ghostSuperado: true, ghostRival: null });
    expect(m?.tipo).toBe('ghost');
    expect(m?.comparativa).toBeNull();
  });

  it('el reto secreto es del grupo entero', () => {
    const m = momentoDe({ ...BASE, secretoAbierto: true });
    expect(m?.tipo).toBe('secreto');
  });

  it('el record va el ultimo, y solo si no ha pasado nada mejor', () => {
    expect(momentoDe({ ...BASE, record: true, mejora: 420 })?.tipo).toBe('record');
    // Con un adelantamiento por medio, la historia es el adelantamiento.
    expect(
      momentoDe({ ...BASE, record: true, mejora: 420, adelantados: [{ nombre: 'M', total: 10 }] })?.tipo,
    ).toBe('porPoco');
  });
});

describe('los casos que romperian el poster', () => {
  it('un empate no cuenta como adelantamiento', () => {
    const m = momentoDe({ ...BASE, adelantados: [{ nombre: 'MARC', total: BASE.puntuacion }] });
    // Se ofrece, pero sin diferencia: "+0" seria absurdo en la imagen.
    expect(m?.comparativa?.diferencia).toBeNull();
  });

  it('un nombre largo llega entero a la comparativa', () => {
    // El renderer lo encoge; aqui solo se comprueba que no se corta antes.
    const m = momentoDe({ ...BASE, yo: 'ALEJANDRA', adelantados: [{ nombre: 'BARTOLOMEO', total: 100 }] });
    expect(m?.comparativa?.etiquetaA).toBe('ALEJANDRA');
    expect(m?.comparativa?.etiquetaB).toBe('BARTOLOMEO');
  });

  it('las cifras llevan separador de miles como en pantalla', () => {
    const m = momentoDe({ ...BASE, puntuacion: 128450, adelantados: [{ nombre: 'M', total: 1000 }] });
    expect(m?.cifra).toBe('128.450');
  });

  it('una puntuacion de cero no rompe nada', () => {
    const m = momentoDe({ ...BASE, puntuacion: 0, secretoAbierto: true });
    expect(m).not.toBeNull();
  });

  it('todos los momentos traen lo que el dibujante necesita', () => {
    // El renderer no consulta nada: si un campo faltara, dibujaria "undefined".
    const casos: DatosMomento[] = [
      { ...BASE, lider: true, robaLiderato: true, adelantados: [{ nombre: 'M', total: 6350 }] },
      { ...BASE, adelantados: [{ nombre: 'M', total: 6464 }] },
      { ...BASE, record: true, mejora: 420 },
      { ...BASE, racha: 5 },
      { ...BASE, apuesta: 'doblo', apuestaAntes: 814 },
      { ...BASE, apuesta: 'cayo', apuestaAntes: 814 },
      { ...BASE, ghostSuperado: true, ghostRival: 'MARC' },
      { ...BASE, secretoAbierto: true },
    ];
    for (const caso of casos) {
      const m = momentoDe(caso);
      expect(m, JSON.stringify(caso)).not.toBeNull();
      for (const campo of ['titulo', 'cifra', 'cifraPie', 'jugador', 'remate', 'donde', 'color', 'texto', 'boton'] as const) {
        expect(m?.[campo], `${m?.tipo}.${campo}`).toBeTruthy();
        expect(String(m?.[campo]), `${m?.tipo}.${campo}`).not.toContain('undefined');
      }
      expect(m?.color, `${m?.tipo}.color`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('nombres', () => {
  it('encadena segun cuantos sean', () => {
    expect(unirNombres([])).toBe('');
    expect(unirNombres(['MARC'])).toBe('MARC');
    expect(unirNombres(['MARC', 'KALI'])).toBe('MARC y KALI');
    expect(unirNombres(['A', 'B', 'C'])).toBe('A, B y C');
    expect(unirNombres(['A', 'B', 'C', 'D'])).toBe('A, B y 2 mas');
  });
});

describe('invitacion', () => {
  it('lleva el codigo y dice en que consiste', () => {
    const texto = textoInvitacion('K3P9');
    expect(texto).toContain('K3P9');
    // Quien lo recibe no conoce el juego: el texto tiene que decir que es.
    expect(texto.toLowerCase()).toContain('retos al día');
  });
});
