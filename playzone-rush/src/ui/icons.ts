/**
 * Iconos de los controles, en SVG.
 *
 * Los emoji siguen estando donde son expresion (🔥 DOBLO, 💀 CAYO, 👑): ahi
 * aportan color y se entienden solos. Pero los CONTROLES no son expresion, y
 * un emoji de control se dibuja distinto en cada sistema: en iOS sale el
 * altavoz azul de Apple, en Android otro, y en un Linux sin fuente de color
 * sale un icono gris plano. Un boton que cambia de aspecto segun el telefono
 * es lo que separa una pagina de un producto, asi que estos van vectoriales:
 * mismo trazo, mismo color de la marca y nitidez a cualquier densidad.
 */
import { el } from './dom';

export type IconName = 'sonido' | 'silencio' | 'pausa';

/**
 * Trazos a 24x24. Solo el contorno: el color lo pone `currentColor`, asi el
 * icono hereda el estado del boton (apagado, activo, marca) sin duplicar SVGs.
 */
const TRAZOS: Record<IconName, string> = {
  sonido:
    '<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M15.6 9.4a4.2 4.2 0 0 1 0 5.2M18.3 7a7.6 7.6 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  silencio:
    '<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M16 9.6l4.4 4.8M20.4 9.6L16 14.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  pausa:
    '<path d="M9 5.5v13M15 5.5v13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
};

/** El trazo en crudo. Se expone para poder revisarlo sin montar un DOM. */
export function trazoDeIcono(name: IconName): string {
  return TRAZOS[name];
}

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  // Decorativo: el texto accesible va en el aria-label del boton, no aqui.
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = TRAZOS[name];
  return svg;
}

export interface IconButton extends HTMLButtonElement {
  /** Cambia el icono sin rehacer el boton (y sin perder el foco). */
  setIcon(name: IconName, label: string): void;
}

export function iconButton(
  name: IconName,
  label: string,
  className: string,
  onPress: () => void,
): IconButton {
  const node = el('button', { class: className }) as IconButton;
  node.type = 'button';
  node.setIcon = (next: IconName, nextLabel: string) => {
    node.replaceChildren(icon(next));
    node.setAttribute('aria-label', nextLabel);
    node.title = nextLabel;
  };
  node.setIcon(name, label);
  node.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (node.disabled) return;
    onPress();
  });
  return node;
}

/* -------------------------------------------------------------------- */
/* Marcas de juego                                                       */
/* -------------------------------------------------------------------- */

/**
 * Un simbolo por juego, todos con el mismo trazo y la misma caja de 24x24.
 *
 * Antes cada juego traia un caracter suelto (✋, ◎, ♪, ▦...) y el resultado
 * era una fila de iconos que no se parecian entre si: unos salian como emoji
 * de color, otros como glifo gris, y el tamano bailaba segun la fuente. Aqui
 * se dibujan, asi que se parecen entre si Y son distintos entre si, que es lo
 * que hace que cada reto tenga cara propia.
 *
 * No llevan color: heredan `currentColor`, y `.card__icon` ya pinta con el
 * acento del juego. Un solo dibujo sirve para los ocho colores.
 */
export type MarcaName =
  | 'drift'
  | 'pulse'
  | 'snap'
  | 'memory'
  | 'ritmo'
  | 'trazo'
  | 'freno'
  | 'caza'
  | 'cuenta'
  | 'torre'
  | 'trile'
  | 'carga'
  | 'secreto'
  | 'llave'
  | 'chaos';

const T = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

const MARCAS: Record<MarcaName, string> = {
  // Nave subiendo entre dos paredes: es exactamente lo que se ve al jugar.
  drift:
    `<path d="M5 3.5v17M19 3.5v17" ${T} stroke-width="1.7" opacity="0.55"/>` +
    `<path d="M12 8.2l4 7.4H8z" ${T} stroke-width="2"/>`,
  // Anillos que se cierran sobre el centro: el momento exacto de PULSE.
  pulse:
    `<circle cx="12" cy="12" r="8.2" ${T} stroke-width="1.6" opacity="0.5"/>` +
    `<circle cx="12" cy="12" r="4.6" ${T} stroke-width="2"/>` +
    '<circle cx="12" cy="12" r="1.7" fill="currentColor"/>',
  // Diana con las cruces: disparar al centro.
  snap:
    `<circle cx="12" cy="12" r="7.6" ${T} stroke-width="2"/>` +
    `<path d="M12 1.8v4.2M12 18v4.2M1.8 12h4.2M18 12h4.2" ${T} stroke-width="1.9"/>` +
    '<circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  // Rejilla con una celda encendida: la que hay que recordar.
  memory:
    `<rect x="3.6" y="3.6" width="7" height="7" rx="1.6" ${T} stroke-width="1.8"/>` +
    `<rect x="13.4" y="3.6" width="7" height="7" rx="1.6" ${T} stroke-width="1.8" opacity="0.45"/>` +
    `<rect x="3.6" y="13.4" width="7" height="7" rx="1.6" ${T} stroke-width="1.8" opacity="0.45"/>` +
    '<rect x="13.4" y="13.4" width="7" height="7" rx="1.6" fill="currentColor"/>',
  // Compas: cuatro tiempos y el fuerte mas alto. Se lee como pulso, no como
  // aplicacion de musica.
  ritmo:
    `<path d="M3 12h2.6M18.4 12H21" ${T} stroke-width="1.7" opacity="0.5"/>` +
    `<path d="M8 7.4v9.2M12 3.8v16.4M16 7.4v9.2" ${T} stroke-width="2.2"/>`,
  // Trazo con el dedo al final del recorrido.
  trazo:
    `<path d="M4 16.5c3.4-9.6 8.2-11 10-6.6 1.2 3-1.6 5.4-2.9 3.4-1-1.5 1.3-4 4.2-2.2 1.4.9 2.4 2.4 3.2 4" ${T} stroke-width="2"/>` +
    '<circle cx="19.1" cy="16" r="2.3" fill="currentColor"/>',
  // Prohibido: la regla de FRENO es "esto no se toca".
  freno:
    `<circle cx="12" cy="12" r="8.4" ${T} stroke-width="2"/>` +
    `<path d="M6.1 6.1l11.8 11.8" ${T} stroke-width="2.2"/>`,
  // Tres flechas mirando igual y una torcida: la partida entera en un icono.
  caza:
    `<path d="M4.6 14.2l2.4-3 2.4 3" ${T} stroke-width="1.9" opacity="0.5"/>` +
    `<path d="M14.6 14.2l2.4-3 2.4 3" ${T} stroke-width="1.9" opacity="0.5"/>` +
    `<path d="M4.6 21.2l2.4-3 2.4 3" ${T} stroke-width="1.9" opacity="0.5"/>` +
    `<path d="M13.4 6.6l3.8-.7.6 3.8" ${T} stroke-width="2.3"/>`,
  // Dos nubes: la de la derecha tiene mas. No hace falta contarlas para verlo.
  cuenta:
    '<circle cx="5.4" cy="7.6" r="1.5" fill="currentColor" opacity="0.75"/>' +
    '<circle cx="9" cy="12" r="1.5" fill="currentColor" opacity="0.75"/>' +
    '<circle cx="5" cy="16.2" r="1.5" fill="currentColor" opacity="0.75"/>' +
    `<path d="M12 3.4v17.2" ${T} stroke-width="1.4" opacity="0.35"/>` +
    '<circle cx="16" cy="6.4" r="1.5" fill="currentColor"/>' +
    '<circle cx="20" cy="9.4" r="1.5" fill="currentColor"/>' +
    '<circle cx="15.4" cy="12.4" r="1.5" fill="currentColor"/>' +
    '<circle cx="19.4" cy="15.4" r="1.5" fill="currentColor"/>' +
    '<circle cx="15.8" cy="18.4" r="1.5" fill="currentColor"/>',
  // Bloques que se estrechan segun suben, y el de arriba descolocado.
  torre:
    `<rect x="3.6" y="17.4" width="16.8" height="3.4" rx="1" ${T} stroke-width="1.8"/>` +
    `<rect x="5.2" y="13.2" width="13.6" height="3.4" rx="1" ${T} stroke-width="1.8"/>` +
    `<rect x="7.4" y="9" width="9.6" height="3.4" rx="1" ${T} stroke-width="1.8"/>` +
    '<rect x="9.8" y="4.2" width="8" height="3.4" rx="1" fill="currentColor"/>',
  // Tres discos y el arco del cambiazo por encima.
  trile:
    `<path d="M6.6 8.2c2.6-3.4 8.2-3.4 10.8 0" ${T} stroke-width="1.7" opacity="0.55"/>` +
    `<circle cx="5.4" cy="15.4" r="3.4" ${T} stroke-width="1.9"/>` +
    '<circle cx="12" cy="15.4" r="3.4" fill="currentColor"/>' +
    `<circle cx="18.6" cy="15.4" r="3.4" ${T} stroke-width="1.9"/>`,
  // Anillo a medio cargar con la franja buena marcada.
  carga:
    `<circle cx="12" cy="12" r="8.2" ${T} stroke-width="1.6" opacity="0.4"/>` +
    `<path d="M12 3.8a8.2 8.2 0 0 1 7.1 4.1" ${T} stroke-width="2.6"/>` +
    `<path d="M19.9 10.4a8.2 8.2 0 0 1-.9 5.4" ${T} stroke-width="2.6" opacity="0.55"/>` +
    '<circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  secreto:
    `<rect x="4.4" y="10.4" width="15.2" height="10.2" rx="2.6" ${T} stroke-width="1.9"/>` +
    `<path d="M8 10.4V8a4 4 0 0 1 8 0v2.4" ${T} stroke-width="1.9"/>` +
    '<circle cx="12" cy="15.4" r="1.5" fill="currentColor"/>',
  llave:
    `<circle cx="8" cy="8" r="4.2" ${T} stroke-width="1.9"/>` +
    `<path d="M11 11l8.4 8.4M15.4 15.4l2.2-2.2M17.8 17.8l2.2-2.2" ${T} stroke-width="1.9"/>`,
  // Estrella rota: seis brazos desiguales. CHAOS no es simetrico.
  chaos:
    `<path d="M12 2.6v18.8M4.2 7.2l15.6 9.6M19.8 7.2L4.2 16.8" ${T} stroke-width="2"/>` +
    '<circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
};

/** El dibujo en crudo de una marca, para revisarlo sin DOM. */
export function trazoDeMarca(name: MarcaName): string {
  return MARCAS[name];
}

/** El simbolo de un juego, a la medida de la caja de la tarjeta. */
export function marca(name: MarcaName, size = 21): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = MARCAS[name];
  return svg;
}

/** Si un juego nuevo no tiene marca todavia, se avisa en vez de dibujar nada. */
export function hayMarca(name: string): name is MarcaName {
  return name in MARCAS;
}
