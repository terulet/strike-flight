/**
 * DOBLE O NADA.
 *
 * Lo que se comprueba con mas cuidado es que el microdesafio sea GANABLE POR
 * HABILIDAD y no una ruleta: el indicador tiene que moverse de forma
 * predecible, pasar por la zona buena varias veces en los cinco segundos, y
 * la zona nunca puede quedar pegada a un extremo. Si esto se rompiera, el
 * jugador sentiria que pierde por suerte, y ese es el fallo que hunde el
 * sistema entero.
 */
import { describe, expect, it } from 'vitest';
import {
  APUESTA_MS,
  APUESTA_TENSION_CUES,
  FACTOR_GANA,
  FACTOR_PIERDE,
  avanzarApuesta,
  dentroDeZona,
  nuevaApuesta,
  posicionVisible,
  resolverApuesta,
} from '../src/meta/apuesta';

/** Simula el microdesafio entero a 60 fps y devuelve la traza. */
function simular(estado = nuevaApuesta(() => 0.5), ms = APUESTA_MS) {
  const dt = 1 / 60;
  const posiciones: number[] = [];
  const dentro: boolean[] = [];
  let actual = estado;
  for (let t = 0; t < ms / 1000; t += dt) {
    actual = avanzarApuesta(actual, dt);
    posiciones.push(posicionVisible(actual));
    dentro.push(dentroDeZona(actual));
  }
  return { posiciones, dentro, final: actual };
}

describe('multiplicadores', () => {
  it('la tension final escala en tres golpes claros de sonido y haptica', () => {
    expect(APUESTA_TENSION_CUES).toEqual([
      { ms: 1500, intensity: 0, haptic: 'tick' },
      { ms: 1000, intensity: 0.5, haptic: 'light' },
      { ms: 500, intensity: 1, haptic: 'medium' },
    ]);
  });

  it('ganar dobla la puntuacion de ese reto', () => {
    const r = resolverApuesta(1000, true);
    expect(r.puntuacionFinal).toBe(2000);
    expect(r.diferencia).toBe(1000);
    expect(FACTOR_GANA).toBe(2);
  });

  it('perder la deja a la mitad', () => {
    const r = resolverApuesta(1000, false);
    expect(r.puntuacionFinal).toBe(500);
    expect(r.diferencia).toBe(-500);
    expect(FACTOR_PIERDE).toBe(0.5);
  });

  it('con cero puntos no se puede perder nada, pero tampoco ganar', () => {
    expect(resolverApuesta(0, true).puntuacionFinal).toBe(0);
    expect(resolverApuesta(0, false).puntuacionFinal).toBe(0);
  });

  it('redondea a entero: el ranking no lleva decimales', () => {
    expect(Number.isInteger(resolverApuesta(777, false).puntuacionFinal)).toBe(true);
  });
});

describe('el microdesafio se gana por habilidad, no por suerte', () => {
  it('el indicador se mueve de forma continua y predecible', () => {
    const { posiciones } = simular();
    // Sin saltos: entre fotograma y fotograma nunca se teletransporta.
    for (let i = 1; i < posiciones.length; i++) {
      const salto = Math.abs((posiciones[i] as number) - (posiciones[i - 1] as number));
      expect(salto).toBeLessThan(0.05);
    }
  });

  it('recorre todo el rango, asi que la zona siempre es alcanzable', () => {
    const { posiciones } = simular();
    expect(Math.min(...posiciones)).toBeLessThan(0.08);
    expect(Math.max(...posiciones)).toBeGreaterThan(0.92);
  });

  it('pasa por la zona buena varias veces en los cinco segundos', () => {
    const { dentro } = simular();
    // Cuenta cuantas veces ENTRA (flanco de subida), no cuantos fotogramas
    // pasa dentro: lo que importa es cuantas oportunidades reales tiene.
    let oportunidades = 0;
    for (let i = 1; i < dentro.length; i++) {
      if (dentro[i] && !dentro[i - 1]) oportunidades++;
    }
    expect(oportunidades).toBeGreaterThanOrEqual(3);
  });

  it('la ventana de acierto dura lo suficiente para reaccionar', () => {
    const { dentro } = simular();
    let mayorRacha = 0;
    let racha = 0;
    for (const d of dentro) {
      racha = d ? racha + 1 : 0;
      mayorRacha = Math.max(mayorRacha, racha);
    }
    // A 60 fps, mas de 12 fotogramas son ~200 ms: se puede clavar con pulso,
    // pero hay que estar atento. Menos que eso ya seria azar.
    expect(mayorRacha).toBeGreaterThan(12);
  });

  it('la zona nunca queda pegada a un extremo', () => {
    // Pegada al borde seria casi imposible por como frena el ojo, y empezaria
    // a parecerse a la mala suerte.
    for (let i = 0; i <= 20; i++) {
      const estado = nuevaApuesta(() => i / 20);
      expect(estado.zonaInicio).toBeGreaterThanOrEqual(0.25);
      expect(estado.zonaInicio + estado.zonaAncho).toBeLessThanOrEqual(0.75);
    }
  });

  it('la velocidad es constante: se puede aprender', () => {
    const a = nuevaApuesta(() => 0.1);
    const b = nuevaApuesta(() => 0.9);
    expect(a.velocidad).toBe(b.velocidad);
  });

  it('quien clava el momento gana siempre', () => {
    // El bot "perfecto": para justo cuando esta dentro. Debe ganar el 100%.
    for (let i = 0; i <= 10; i++) {
      const { dentro } = simular(nuevaApuesta(() => i / 10));
      expect(dentro.some(Boolean), `zona ${i}`).toBe(true);
    }
  });

  it('no se puede ganar tocando en cualquier momento', () => {
    // La otra cara: si el indicador pasase casi todo el rato dentro de la
    // zona, tocar sin mirar bastaria y no habria apuesta ninguna. Tiene que
    // estar fuera la mayor parte del tiempo.
    const { dentro } = simular();
    const fraccionDentro = dentro.filter(Boolean).length / dentro.length;
    expect(fraccionDentro).toBeLessThan(0.35);
    expect(fraccionDentro).toBeGreaterThan(0.1);
  });
});
