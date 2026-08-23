/**
 * EL SORTEO: "los juegos de hoy".
 *
 * Tres columnas que giran y se paran una a una revelando los tres retos del
 * dia. La referencia es el momento de la tragaperras -esa espera de medio
 * segundo entre que para la segunda y la tercera- pero SIN la estetica: nada
 * de cerezas, dorados chillones ni luces parpadeando. Aqui lo que gira son las
 * marcas de los propios juegos, cada una en su color, sobre columnas de
 * cristal oscuro.
 *
 * Lo que hace que esto funcione y no sea decoracion:
 *
 * 1. LAS COLUMNAS PARAN UNA A UNA, no las tres a la vez. La tension esta en el
 *    hueco entre parada y parada. Si paran juntas no hay sorteo, hay una
 *    transicion.
 * 2. DURA POCO. 2,2 segundos hasta la ultima parada. Un sorteo de cinco
 *    segundos es largo el primer dia e insufrible el cuarto.
 * 3. SE SALTA TOCANDO. En cualquier momento, y saltarlo deja los tres retos
 *    puestos: quien tiene prisa no pierde informacion.
 * 4. SE VE UNA VEZ AL DIA. La marca vive en el dia (revealVisto). Al volver de
 *    una partida o al recargar no vuelve a salir.
 * 5. NO DECIDE NADA. El sorteo del dia ya esta hecho por la semilla del dia
 *    antes de que esto se pinte; esto solo lo CUENTA. Si alguien lo salta, los
 *    retos son exactamente los mismos.
 *
 * El sonido acompana pero no cuenta la historia: en la primera apertura iOS
 * todavia no ha desbloqueado el audio y esto tiene que entenderse en silencio.
 */
import type { AudioBus } from '../core/audio';
import type { Haptics } from '../core/haptics';
import type { ChallengeSpec } from '../meta/daily';
import { requireGame } from '../game/registry';
import { el } from './dom';
import { hayMarca, marca } from './icons';

/** Cuando para cada columna, en ms desde que arranca. */
const PARADAS_MS = [900, 1500, 2150];
/** Lo que se queda en pantalla despues de la ultima parada. */
const REMATE_MS = 900;
/** Simbolos por columna mientras gira. */
const TIRA = 9;

export interface RevealOptions {
  audio?: AudioBus;
  haptics?: Haptics;
  reducedMotion?: boolean;
}

/**
 * Pinta el sorteo y lo quita solo.
 *
 * @returns una funcion para cortarlo antes de tiempo (por ejemplo si el
 *          jugador arranca una partida desde una notificacion).
 */
export function mostrarSorteo(
  retos: ChallengeSpec[],
  alTerminar: () => void,
  options: RevealOptions = {},
): () => void {
  const quieto = options.reducedMotion ?? prefiereMenosMovimiento();
  const temporizadores: ReturnType<typeof setTimeout>[] = [];
  let cerrado = false;

  const capa = el('div', { class: 'sorteo' });
  const columnas = retos.map((spec, i) => construirColumna(spec, i));

  capa.appendChild(
    el('div', { class: 'sorteo__caja' }, [
      el('div', { class: 'sorteo__cabecera' }, [
        el('div', { class: 'sorteo__rotulo rotulo', text: 'HOY TOCA' }),
        el('div', { class: 'sorteo__titulo', text: 'RUSH DE HOY' }),
      ]),
      el('div', { class: 'sorteo__reels' }, columnas.map((c) => c.nodo)),
      el('div', { class: 'sorteo__pista', text: 'TOCA PARA SALTAR' }),
    ]),
  );

  const cerrar = (): void => {
    if (cerrado) return;
    cerrado = true;
    for (const t of temporizadores) clearTimeout(t);
    capa.classList.add('sorteo--fuera');
    // El desvanecido no puede retrasar la portada: se avisa ya y la capa se
    // va sola por detras.
    setTimeout(() => capa.remove(), 260);
    alTerminar();
  };

  /** Saltar: se paran las tres de golpe y se sale. */
  const saltar = (): void => {
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.length = 0;
    for (const columna of columnas) columna.parar(false);
    temporizadores.push(setTimeout(cerrar, 320));
  };

  capa.addEventListener('pointerdown', saltar);
  document.body.appendChild(capa);

  if (quieto) {
    // Sin movimiento: los tres retos puestos y fuera. Se ve la informacion,
    // que es lo que importa; el espectaculo es opcional.
    for (const columna of columnas) columna.parar(false);
    temporizadores.push(setTimeout(cerrar, 1100));
    return cerrar;
  }

  for (const columna of columnas) columna.girar();

  columnas.forEach((columna, i) => {
    temporizadores.push(
      setTimeout(() => {
        columna.parar(true);
        options.audio?.play(i === columnas.length - 1 ? 'unlock' : 'select');
        options.haptics?.fire(i === columnas.length - 1 ? 'heavy' : 'medium');
      }, PARADAS_MS[i] ?? 0),
    );
  });

  const ultima = PARADAS_MS[PARADAS_MS.length - 1] ?? 0;
  temporizadores.push(setTimeout(cerrar, ultima + REMATE_MS));

  return cerrar;
}

/* -------------------------------------------------------------------- */
/* Una columna                                                           */
/* -------------------------------------------------------------------- */

interface Columna {
  nodo: HTMLElement;
  girar: () => void;
  parar: (conGolpe: boolean) => void;
}

function construirColumna(spec: ChallengeSpec, indice: number): Columna {
  const meta = requireGame(spec.gameId).meta;

  // La tira que gira: simbolos al azar y, EN EL ULTIMO SITIO, el de verdad.
  // Al frenar la tira se coloca en ese ultimo hueco, asi que lo que se ve
  // aterrizar es el juego real y no un cambiazo al final.
  const senuelos = simbolosSenuelo(meta.id, TIRA - 1);
  const tira = el(
    'div',
    { class: 'reel__tira' },
    [...senuelos, meta.id].map((id) => el('div', { class: 'reel__casilla' }, [simbolo(id)])),
  );

  const columna = el(
    'div',
    { class: 'reel', style: { '--accent': meta.accent, '--casillas': String(TIRA) } },
    [
      el('div', { class: 'reel__ventana' }, [tira]),
      el('div', { class: 'reel__pie' }, [
        el('div', { class: 'reel__reto rotulo', text: spec.title }),
        el('div', { class: 'reel__nombre', text: meta.name }),
      ]),
    ],
  );

  return {
    nodo: columna,
    girar: () => {
      // Cada columna gira a un ritmo ligeramente distinto: tres columnas
      // sincronizadas parecen una sola pieza moviendose.
      columna.style.setProperty('--vuelta', `${190 + indice * 26}ms`);
      columna.classList.add('reel--gira');
    },
    parar: (conGolpe: boolean) => {
      columna.classList.remove('reel--gira');
      columna.classList.add('reel--parada');
      if (conGolpe) columna.classList.add('reel--golpe');
    },
  };
}

/** El dibujo de un juego; si no tuviera marca, su inicial. */
function simbolo(id: string): HTMLElement {
  if (hayMarca(id)) return el('div', { class: 'reel__marca' }, [marca(id, 30)]);
  return el('div', { class: 'reel__marca', text: id.slice(0, 1).toUpperCase() });
}

/**
 * Los simbolos que pasan de largo mientras gira.
 *
 * Se cogen del registro y se excluye el ganador, para que el juego del dia no
 * aparezca cuatro veces durante el giro: si ya lo has visto pasar, verlo
 * aterrizar no sorprende.
 */
function simbolosSenuelo(ganador: string, cuantos: number): string[] {
  const otros = ['pulse', 'drift', 'snap', 'memory', 'ritmo', 'trazo', 'freno'].filter(
    (id) => id !== ganador && hayMarca(id),
  );
  const salida: string[] = [];
  for (let i = 0; i < cuantos; i++) salida.push(otros[i % otros.length] ?? ganador);
  return salida;
}

function prefiereMenosMovimiento(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
