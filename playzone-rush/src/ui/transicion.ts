/**
 * LA TARJETA SE CONVIERTE EN EL JUEGO.
 *
 * Antes, pulsar una tarjeta montaba la pantalla de partida encima: un corte
 * seco. Ahora la tarjeta crece hasta llenar la pantalla y el juego aparece
 * DENTRO de esa misma superficie, asi que no se percibe un cambio de pantalla
 * sino una transformacion.
 *
 * COMO: se mide la tarjeta, se clona su aspecto en una capa fija encima de
 * todo, y esa capa se anima hasta el borde de la pantalla mientras se le va la
 * opacidad. La pantalla de partida se monta DEBAJO desde el primer fotograma.
 *
 * DOS REGLAS QUE NO SE SALTAN:
 *
 * 1. NO BLOQUEA. La partida se monta y la cuenta atras arranca en el mismo
 *    instante en que empieza la animacion, no al acabarla. La capa lleva
 *    pointer-events:none. Si esto retrasara el juego aunque fuera 100 ms,
 *    seria una animacion ornamental que le quita tiempo al jugador, y eso es
 *    justo lo que no se quiere.
 * 2. SE PUEDE APAGAR. Con prefers-reduced-motion no hay morphing: se monta y
 *    ya. La continuidad es un lujo; jugar no lo es.
 *
 * Solo se anima transform y opacity, que van por composicion: ni layout ni
 * repintado por fotograma mientras el juego ya esta arrancando debajo.
 */

/** Lo que dura el crecimiento. Dentro de la ventana pedida de 350-600 ms. */
export const DURACION_MS = 420;

export interface MorphOptions {
  /** Color del juego, para el filo y el resplandor de la capa. */
  acento: string;
  /** Nombre del juego, que se queda en el centro mientras crece. */
  titulo?: string;
  reducedMotion?: boolean;
}

/**
 * Expande una tarjeta hasta llenar la pantalla.
 *
 * @param tarjeta  el elemento pulsado, para medirlo antes de que desaparezca
 * @param alArrancar  monta la partida; se llama YA, no al terminar
 * @returns una funcion para cortar la animacion antes de tiempo
 */
export function expandirTarjeta(
  tarjeta: HTMLElement | null,
  options: MorphOptions,
  alArrancar: () => void,
): () => void {
  const quieto = options.reducedMotion ?? prefiereMenosMovimiento();
  const caja = tarjeta?.getBoundingClientRect();

  // Sin tarjeta que medir (revancha, encadenado, teclado) o sin movimiento:
  // se arranca y punto. La transicion es un adorno con sentido, no un paso.
  if (!caja || quieto || caja.width < 1) {
    alArrancar();
    return () => {};
  }

  const capa = document.createElement('div');
  capa.className = 'morph';
  capa.style.setProperty('--acento', options.acento);
  capa.style.left = `${caja.left}px`;
  capa.style.top = `${caja.top}px`;
  capa.style.width = `${caja.width}px`;
  capa.style.height = `${caja.height}px`;

  if (options.titulo) {
    const titulo = document.createElement('div');
    titulo.className = 'morph__titulo';
    titulo.textContent = options.titulo;
    capa.appendChild(titulo);
  }
  document.body.appendChild(capa);

  // La partida se monta AHORA, debajo de la capa. Cuando la capa se disuelve
  // el juego ya lleva 420 ms vivo y la cuenta atras ya va por la mitad.
  alArrancar();

  // Cuanto tiene que crecer y hacia donde, para acabar cubriendo la pantalla.
  const anchoFinal = window.innerWidth;
  const altoFinal = window.innerHeight;
  const escalaX = anchoFinal / caja.width;
  const escalaY = altoFinal / caja.height;
  const dx = anchoFinal / 2 - (caja.left + caja.width / 2);
  const dy = altoFinal / 2 - (caja.top + caja.height / 2);

  let animacion: Animation | null = null;
  const quitar = () => {
    animacion?.cancel();
    capa.remove();
  };

  if (typeof capa.animate !== 'function') {
    // Sin API de animaciones se quita en el acto: mejor un corte que una capa
    // opaca clavada encima del juego.
    quitar();
    return () => {};
  }

  // Tres paradas y no dos. Con solo dos, la curva de salida se lleva tambien la
  // opacidad y a los 100 ms la capa ya era medio transparente: se veia la
  // cuenta atras POR DEBAJO de la tarjeta y parecia una doble exposicion en vez
  // de una superficie que crece. Manteniendo la opacidad hasta bien pasada la
  // mitad, primero se ve crecer la tarjeta y solo despues se disuelve.
  animacion = capa.animate(
    [
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1, borderRadius: '22px', offset: 0 },
      {
        transform: `translate(${dx * 0.62}px, ${dy * 0.62}px) scale(${1 + (escalaX - 1) * 0.62}, ${1 + (escalaY - 1) * 0.62})`,
        opacity: 1,
        borderRadius: '14px',
        offset: 0.58,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${escalaX}, ${escalaY})`,
        opacity: 0,
        borderRadius: '0px',
        offset: 1,
      },
    ],
    { duration: DURACION_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
  );
  animacion.onfinish = quitar;
  // Si el navegador se salta el evento (pestana en segundo plano), la capa se
  // va igual: nunca puede quedarse encima de una partida.
  const seguro = setTimeout(quitar, DURACION_MS + 400);
  return () => {
    clearTimeout(seguro);
    quitar();
  };
}

/**
 * El camino de vuelta: el resultado emerge del propio HUD.
 *
 * No es la animacion inversa -eso obligaria a esperar otra vez- sino una
 * subida corta desde abajo con la arena perdiendo intensidad por detras. La
 * puntuacion final se queda en pantalla mientras el panel sube, asi que la
 * cifra no parpadea entre una pantalla y otra.
 */
export function emergerResultado(panel: HTMLElement, reducedMotion?: boolean): void {
  const quieto = reducedMotion ?? prefiereMenosMovimiento();
  if (quieto || typeof panel.animate !== 'function') return;
  panel.animate(
    [
      { opacity: 0, transform: 'translateY(26px) scale(0.985)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
  );
}

function prefiereMenosMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
