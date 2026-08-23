/**
 * La llegada: lo que pasa al abrir la app.
 *
 * Antes se entraba directamente a una lista de tarjetas sobre negro. Funcional,
 * pero abrir el juego no era un momento. Esto pone la marca en pantalla durante
 * poco mas de un segundo, con el rayo dibujandose y un golpe de sonido.
 *
 * DOS REGLAS QUE NO SE SALTAN:
 *
 * 1. No bloquea NUNCA. El overlay lleva pointer-events:none, asi que se puede
 *    tocar la interfaz de debajo desde el primer fotograma. Una intro que
 *    retrasa al usuario deja de ser bonita a la segunda vez que la ves.
 * 2. Se respeta prefers-reduced-motion: quien lo tenga puesto ve la marca
 *    quieta y ya. No es un extra de accesibilidad, es que a algunas personas
 *    este tipo de animacion les sienta mal de verdad.
 *
 * El sonido se intenta, pero en iOS el audio necesita un gesto previo del
 * usuario y en la primera carga no lo hay. Por eso la secuencia se entiende
 * entera sin oir nada: el sonido acompana, no cuenta la historia.
 */
import type { AudioBus } from '../core/audio';

const DURACION_MS = 1250;

export interface BootOptions {
  audio?: AudioBus;
  reducedMotion?: boolean;
}

/**
 * Pinta la secuencia y la quita sola. Devuelve una funcion para cortarla antes
 * (por ejemplo si el usuario ya esta jugando).
 */
export function playBootSequence(
  parent: HTMLElement = document.body,
  options: BootOptions = {},
): () => void {
  const quieto = options.reducedMotion ?? prefiereMenosMovimiento();

  const overlay = document.createElement('div');
  overlay.className = `boot${quieto ? ' boot--quieto' : ''}`;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="boot__marca">
      <svg class="boot__rayo" viewBox="0 0 64 64" width="86" height="86" aria-hidden="true">
        <path d="M36 8 16 36h12l-4 20 20-28H32z" />
      </svg>
      <div class="boot__nombre">
        <span class="boot__zone">PLAYZONE</span><span class="boot__rush">RUSH</span>
      </div>
    </div>`;
  parent.appendChild(overlay);

  // El golpe de marca: dos notas cortas subiendo. Falla en silencio si el
  // navegador aun no ha desbloqueado el audio, que es lo normal al abrir.
  try {
    options.audio?.play('go');
  } catch {
    /* sin audio la secuencia se entiende igual */
  }

  let cortada = false;
  const quitar = (): void => {
    if (cortada) return;
    cortada = true;
    overlay.classList.add('boot--fuera');
    setTimeout(() => overlay.remove(), 260);
  };

  const temporizador = setTimeout(quitar, quieto ? 700 : DURACION_MS);

  return () => {
    clearTimeout(temporizador);
    quitar();
  };
}

function prefiereMenosMovimiento(): boolean {
  if (typeof matchMedia !== 'function') return false;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
