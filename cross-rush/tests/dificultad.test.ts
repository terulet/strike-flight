/**
 * La dificultad como MEDIDA, no como impresion.
 *
 * Durante todo el desarrollo la unica forma de decir si el tramo pedia algo al
 * jugador era la impresion de quien lo miraba. Cuando por fin se midio, la
 * respuesta fue incomoda: un piloto automatico competente llegaba a meta 0,9 s
 * detras de uno perfecto -un 1,5% en 57 segundos- y con la MISMA cadena. O
 * sea que jugar bien no servia para nada, y todo el espectaculo montado encima
 * -cadena, multiplicador, camara lenta- decoraba una vuelta que se pasaba
 * sola.
 *
 * Estas pruebas fijan las tres cosas que lo arreglaron, y las fijan por su
 * efecto observable y no por sus numeros internos, para que se pueda seguir
 * afinando el juego sin reescribirlas:
 *
 *   1. hay un suelo: quien no controla el aire no llega
 *   2. hay un techo alcanzable: quien controla, llega
 *   3. y entre los dos hay recorrido de verdad, medido en PUNTOS
 */
import { describe, expect, it } from 'vitest';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { runPilot } from './support/autopilot';

const track = buildCanyonRun();
const perfecto = runPilot(track, 'perfecto');
const competente = runPilot(track, 'competente');
const descuidado = runPilot(track, 'descuidado');

describe('la vuelta pide algo al jugador', () => {
  it('quien no hace nada en el aire no llega a meta', () => {
    // El piloto descuidado mantiene el gas y no toca el cuerpo en todo el
    // vuelo. Si ese llega, el juego no pide nada.
    expect(descuidado.state).toBe('CRASHED');
    // El limite es holgado a proposito. Lo que importa es que NO llega, no en
    // que metro exacto cae: al dar al aire un freno de rotacion al soltar el
    // mando, este piloto paso de morir en el metro 208 a aguantar hasta el
    // 514, y una cota ajustada al numero de ayer habria fallado por un cambio
    // que mejora el juego.
    expect(descuidado.x).toBeLessThan(track.finishX * 0.75);
  });

  it('quien controla el aire llega, aunque no sea perfecto', () => {
    // Y este es el otro lado: con 180 ms de reaccion, mando grueso y sesgo de
    // punteria -o sea, un jugador decente y no una maquina- la vuelta se
    // termina. Un tramo que solo pasa el piloto perfecto no es dificil, es
    // injusto.
    expect(competente.state).toBe('FINISHED');
    expect(perfecto.state).toBe('FINISHED');
  });

  it('jugar bien se paga: la puntuacion del perfecto casi dobla la del competente', () => {
    // Este es EL numero. Antes de que aterrizar bien costara y la cadena
    // pidiera precision, los dos pilotos sacaban practicamente lo mismo.
    // 1,5x es el SUELO de "jugar bien se paga", no la medida de hoy: medido
    // ahora son 20.310 contra 12.580, o sea 1,6x. Antes de este trabajo eran
    // practicamente iguales.
    expect(perfecto.score).toBeGreaterThan(competente.score * 1.5);
    expect(competente.score).toBeGreaterThan(descuidado.score * 5);
  });

  it('el perfecto clava mas aterrizajes, y de ahi sale la diferencia', () => {
    // La cadena mide precision: solo la alarga un PERFECT. Si esto deja de
    // cumplirse, el multiplicador ha vuelto a ser un contador de saltos.
    expect(perfecto.landings.PERFECT).toBeGreaterThan(competente.landings.PERFECT);
    expect(perfecto.bestCombo).toBeGreaterThanOrEqual(competente.bestCombo);
  });

  it('la cadena no se regala: nadie la mantiene entera de punta a punta', () => {
    // La vuelta tiene ~25 vuelos. Con la ventana fija de 4,5 s era imposible
    // que caducara y las cadenas llegaban a 20 eslabones sin merito. Con la
    // ventana que se estrecha, ni el piloto perfecto encadena mas de una parte
    // de la vuelta.
    expect(perfecto.bestCombo).toBeLessThan(12);
    expect(perfecto.bestCombo).toBeGreaterThan(3);
  });
});
