/**
 * Lo que se cuenta cuando pasa algo. Es texto que sale de la app y llega al
 * chat de otra persona, asi que conviene que este probado.
 */
import { describe, expect, it } from 'vitest';
import { momentoDe, textoInvitacion, unirNombres, type DatosMomento } from '../src/meta/compartir';

const BASE: DatosMomento = {
  yo: 'ELOI',
  reto: 'RETO 1',
  juego: 'PULSE',
  puntuacion: 2750,
  adelantados: [],
  lider: false,
  record: false,
  apuesta: null,
};

describe('momentos compartibles', () => {
  it('una partida normal no ofrece compartir', () => {
    // Lo importante de este sistema no es lo que ofrece, sino lo que NO
    // ofrece: si el boton sale siempre, deja de significar nada.
    expect(momentoDe(BASE)).toBeNull();
  });

  it('ponerse primero se cuenta', () => {
    const m = momentoDe({ ...BASE, lider: true });
    expect(m?.tipo).toBe('lider');
    expect(m?.texto).toContain('2.750');
    expect(m?.texto).toContain('primero');
  });

  it('adelantar a alguien se cuenta con su nombre', () => {
    const m = momentoDe({ ...BASE, adelantados: ['MARC', 'KALI'] });
    expect(m?.tipo).toBe('adelanta');
    expect(m?.texto).toContain('MARC y KALI');
  });

  it('perder la apuesta tambien se ofrece', () => {
    // Esconder el fracaso seria perder la mitad de la conversacion que genera.
    const m = momentoDe({ ...BASE, apuesta: 'cayo' });
    expect(m?.tipo).toBe('cayo');
    expect(m?.boton).toBe('CONTARLO IGUAL');
  });

  it('la apuesta manda sobre el resto', () => {
    // Jugarsela es lo que mas se cuenta: si ademas te has puesto primero, la
    // historia sigue siendo que te la jugaste.
    const m = momentoDe({ ...BASE, apuesta: 'doblo', lider: true, adelantados: ['MARC'] });
    expect(m?.tipo).toBe('doblo');
  });

  it('ser lider manda sobre adelantar a uno suelto', () => {
    expect(momentoDe({ ...BASE, lider: true, adelantados: ['MARC'] })?.tipo).toBe('lider');
  });

  it('el record personal se cuenta si no ha pasado nada mejor', () => {
    expect(momentoDe({ ...BASE, record: true })?.tipo).toBe('record');
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
    expect(texto.toLowerCase()).toContain('retos al dia');
  });
});
