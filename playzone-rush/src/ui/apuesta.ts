/**
 * La pantalla de DOBLE O NADA.
 *
 * Dos momentos, y los dos importan:
 *
 * 1. LA DECISION. "GUARDAR MARCA" o "ME LA JUEGO". Se dice en numeros lo que
 *    se gana y lo que se pierde, porque una apuesta a ciegas no es una
 *    decision, es un boton. Una vez pulsado, no hay vuelta atras.
 *
 * 2. EL MICRODESAFIO. Cinco segundos. El indicador barre y hay que pararlo en
 *    la zona. Todo esta a la vista desde el primer instante: nada aparece por
 *    sorpresa. Si se falla, se ha fallado uno.
 */
import { avanzarApuesta, dentroDeZona, nuevaApuesta, posicionVisible, resolverApuesta, APUESTA_MS, APUESTA_TENSION_CUES, type ResultadoApuesta } from '../meta/apuesta';
import { formatScore } from '../meta/ranking';
import { button, el } from './dom';
import type { AudioBus } from '../core/audio';
import type { Haptics } from '../core/haptics';

export interface ApuestaHandlers {
  /** El jugador guarda la marca tal cual. */
  onGuardar: () => void;
  /** El microdesafio ha terminado. */
  onResuelta: (resultado: ResultadoApuesta) => void;
}

export interface ApuestaOptions {
  puntuacion: number;
  audio: AudioBus;
  haptics: Haptics;
}

/** Panel de decision: se pega debajo del resultado. */
export function renderDecision(options: ApuestaOptions, handlers: ApuestaHandlers): HTMLElement {
  const { puntuacion } = options;
  const siGana = Math.round(puntuacion * 2);
  const siPierde = Math.round(puntuacion * 0.5);

  return el('div', { class: 'apuesta' }, [
    el('div', { class: 'apuesta__ficha' }, [
      el('span', { class: 'apuesta__icono', text: '🎲' }),
      el('span', { text: 'TIENES TU FICHA DEL DIA' }),
    ]),
    el('div', { class: 'apuesta__titulo', text: 'DOBLE O NADA' }),
    // Los numeros a la vista: apostar sin saber que te juegas no es decidir.
    el('div', { class: 'apuesta__cuentas' }, [
      el('div', { class: 'apuesta__cuenta apuesta__cuenta--gana' }, [
        el('div', { class: 'apuesta__cuenta-label', text: 'SI LO CLAVAS' }),
        el('div', { class: 'apuesta__cuenta-valor num', text: formatScore(siGana) }),
      ]),
      el('div', { class: 'apuesta__cuenta apuesta__cuenta--pierde' }, [
        el('div', { class: 'apuesta__cuenta-label', text: 'SI FALLAS' }),
        el('div', { class: 'apuesta__cuenta-valor num', text: formatScore(siPierde) }),
      ]),
    ]),
    // Decirlo ANTES, no despues: que apostar cierre el reto es la mitad de la
    // decision, y enterarse a posteriori seria una encerrona.
    el('div', {
      class: 'apuesta__aviso',
      text: 'Una sola por dia. Cierra este reto y no hay vuelta atras.',
    }),
    el('div', { class: 'apuesta__botones' }, [
      button('ME LA JUEGO', 'btn btn--play btn--lg btn--block apuesta__jugar', () => {
        options.audio.play('unlock');
        options.haptics.fire('heavy');
        mostrarDesafio(options, handlers);
      }),
      button('GUARDAR MARCA', 'btn btn--ghost btn--block', () => {
        options.audio.play('back');
        handlers.onGuardar();
      }),
    ]),
  ]);
}

/**
 * El microdesafio, a pantalla completa.
 *
 * Se monta encima de todo para que no haya nada mas que mirar: son cinco
 * segundos y toda la atencion tiene que estar en la barra.
 */
/**
 * Umbrales del tictac final, de mas lejano a mas cercano: al cruzar cada uno
 * (de bajada, restante nunca sube) suena un aviso mas agudo y un haptic un
 * pelin mas fuerte que el anterior. Tres golpes, no un zumbido continuo -en
 * una vibracion de telefono, "cada 100ms durante 1.5s" se siente a avería,
 * no a tension creciente-, y se paran en 500ms para no pisar el sonido de
 * ganar o perder que ya suena en el propio 0.
 */
export function mostrarDesafio(options: ApuestaOptions, handlers: ApuestaHandlers): void {
  let estado = nuevaApuesta(Math.random);
  let resuelto = false;
  let ultimo = performance.now();
  let restante = APUESTA_MS;
  let siguienteUmbral = 0;

  const marca = el('div', { class: 'reto__zona' });
  const aguja = el('div', { class: 'reto__aguja' });
  const barra = el('div', { class: 'reto__barra' }, [marca, aguja]);
  const cuenta = el('div', { class: 'reto__cuenta num', text: '5.0' });

  const capa = el('div', { class: 'reto' }, [
    el('div', { class: 'reto__titulo', text: 'PARALO EN LA ZONA' }),
    barra,
    cuenta,
    el('div', { class: 'reto__pista', text: 'Toca en cualquier sitio' }),
  ]);
  document.body.appendChild(capa);

  marca.style.left = `${estado.zonaInicio * 100}%`;
  marca.style.width = `${estado.zonaAncho * 100}%`;

  const terminar = (gana: boolean): void => {
    if (resuelto) return;
    resuelto = true;
    capa.classList.add(gana ? 'reto--gana' : 'reto--pierde');
    options.audio.play(gana ? 'record' : 'defeat');
    options.haptics.fire(gana ? 'success' : 'error');
    // Un instante para que se vea donde paro: sin esto no se entiende por que
    // se ha ganado o perdido, y perder sin entender por que es lo que cabrea.
    setTimeout(() => {
      capa.remove();
      handlers.onResuelta(resolverApuesta(options.puntuacion, gana));
    }, 900);
  };

  const parar = (): void => {
    if (resuelto) return;
    aguja.classList.add('reto__aguja--parada');
    terminar(dentroDeZona(estado));
  };

  capa.addEventListener('pointerdown', parar);

  const frame = (ahora: number): void => {
    if (resuelto) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    restante -= dt * 1000;

    estado = avanzarApuesta(estado, dt);
    aguja.style.left = `${posicionVisible(estado) * 100}%`;
    aguja.classList.toggle('reto__aguja--dentro', dentroDeZona(estado));
    cuenta.textContent = Math.max(0, restante / 1000).toFixed(1);
    // El ultimo segundo y medio aprieta: el numero se acelera para que se
    // sienta que se acaba el tiempo, no solo que lo dice.
    cuenta.classList.toggle('reto__cuenta--apura', restante <= 1500 && restante > 0);

    // El mismo aprieto, en sonido y vibracion: cada umbral cruzado suena mas
    // agudo y golpea un poco mas fuerte que el anterior.
    while (siguienteUmbral < APUESTA_TENSION_CUES.length && restante <= APUESTA_TENSION_CUES[siguienteUmbral].ms) {
      const cue = APUESTA_TENSION_CUES[siguienteUmbral];
      options.audio.play('apura', cue.intensity);
      options.haptics.fire(cue.haptic);
      siguienteUmbral++;
    }

    // Se acaba el tiempo sin decidir: cuenta como fallo. Dejar pasar los cinco
    // segundos es una decision tambien, y ya habia avisado de que no hay
    // vuelta atras.
    if (restante <= 0) {
      terminar(false);
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
