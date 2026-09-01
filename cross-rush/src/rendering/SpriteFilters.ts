/**
 * SpriteFilters.ts
 *
 * Cachea sprites con un filtro de canvas ya aplicado ("horneado") en un lienzo
 * fuera de pantalla.
 *
 * Motivo, medido: `ctx.filter` no es gratis. Se evalua en CADA `drawImage`, y
 * la bruma atmosferica del fondo son dos capas que cubren la pantalla entera
 * varias teselas cada una. Con el filtro puesto en caliente el juego caia a
 * 5 fps; horneando exactamente el mismo filtro una sola vez por sprite sube a
 * mas de 100. El resultado en pantalla es identico -es el mismo filtro sobre
 * los mismos pixeles-, solo que calculado una vez en vez de sesenta veces por
 * segundo.
 *
 * La cache se llena en el primer uso y solo si la imagen ya esta cargada, asi
 * que un sprite que aun no ha llegado se dibuja sin filtro ese fotograma y se
 * hornea en cuanto puede.
 */

export type Sprite = HTMLImageElement | HTMLCanvasElement;

const cache = new Map<string, HTMLCanvasElement>();

export function spriteWidth(sprite: Sprite): number {
  return 'naturalWidth' in sprite ? sprite.naturalWidth : sprite.width;
}

export function spriteHeight(sprite: Sprite): number {
  return 'naturalHeight' in sprite ? sprite.naturalHeight : sprite.height;
}

export function spriteReady(sprite: Sprite): boolean {
  return 'naturalWidth' in sprite ? sprite.complete && sprite.naturalWidth > 0 : sprite.width > 0;
}

/** Devuelve el sprite con `filter` ya aplicado. Sin filtro, devuelve el original. */
export function filteredSprite(image: HTMLImageElement, filter: string): Sprite {
  if (!filter || filter === 'none') return image;
  if (!image.complete || image.naturalWidth === 0) return image;
  const key = `${image.src}|${filter}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.filter = filter;
  ctx.drawImage(image, 0, 0);
  cache.set(key, canvas);
  return canvas;
}

/**
 * Igual que `filteredSprite`, pero ademas re-escala el sprite al tamano con
 * el que se va a dibujar.
 *
 * Las dos capas de fondo son imagenes grandes que se dibujan reducidas y
 * repetidas por toda la pantalla en cada fotograma; el reescalado se rehacia
 * entero cada vez y era, medido, la parte mas cara del render. Horneado al
 * tamano final, el dibujo pasa a ser una copia 1:1. La cache se indexa por
 * tamano, asi que solo se rehace al cambiar el tamano de la ventana.
 */
export function scaledSprite(image: HTMLImageElement, filter: string, width: number, height: number): Sprite {
  if (!image.complete || image.naturalWidth === 0) return image;
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const key = `${image.src}|${filter}|${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  if (filter && filter !== 'none') ctx.filter = filter;
  ctx.drawImage(image, 0, 0, w, h);
  cache.set(key, canvas);
  return canvas;
}

/** Un sprite horneado con contorno, mas el margen que hubo que anadirle. */
export interface OutlinedSprite {
  source: Sprite;
  /** Pixeles anadidos por cada lado. Hay que sumarlos al pivote al dibujar. */
  pad: number;
}

/**
 * Hornea un sprite con un CONTORNO oscuro alrededor de su silueta.
 *
 * Existe por un problema concreto del piloto: su mono y el carenado de la
 * moto salen del mismo arte, con el mismo estampado rojo y blanco y hasta con
 * el mismo dorsal. Superpuestos, el ojo no puede separarlos: el pecho se
 * disuelve en la moto y el conjunto se lee como una mancha. Es el motivo por
 * el que en casi cualquier juego 2D los personajes recortados llevan un borde
 * -no es un adorno, es lo que los despega del fondo-.
 *
 * El contorno se consigue con varias sombras arrojadas de desplazamiento cero
 * y radio pequeno: apiladas, rodean la silueta entera por igual. Eso obliga a
 * hornear sobre un lienzo MAS GRANDE que el sprite, porque una sombra dibujada
 * justo en el borde se recortaria; de ahi el margen, que el que dibuja tiene
 * que sumar al pivote o la pieza aparecera desplazada.
 */
export function outlinedSprite(image: HTMLImageElement, filter: string, pad: number): OutlinedSprite | null {
  if (!image.complete || image.naturalWidth === 0) return null;
  const key = `${image.src}|outline${pad}|${filter}`;
  const hit = cache.get(key);
  if (hit) return { source: hit, pad };

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth + pad * 2;
  canvas.height = image.naturalHeight + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const radius = Math.max(1, pad * 0.55);
  const outline = `drop-shadow(0 0 ${radius}px rgba(12,8,6,0.95)) drop-shadow(0 0 ${radius}px rgba(12,8,6,0.9))`;
  ctx.filter = filter && filter !== 'none' ? `${filter} ${outline}` : outline;
  ctx.drawImage(image, pad, pad);
  cache.set(key, canvas);
  return { source: canvas, pad };
}
