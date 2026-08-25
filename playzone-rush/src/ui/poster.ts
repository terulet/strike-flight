/**
 * EL MINI-PÓSTER.
 *
 * Dibuja un momento en un lienzo de 1080x1350 (4:5) y devuelve un PNG listo
 * para mandar por WhatsApp. Canvas 2D y nada mas: ni librerias, ni capturas
 * del DOM, ni plantillas externas.
 *
 * POR QUE CANVAS Y NO UNA CAPTURA DEL DOM: una captura arrastra el layout de la
 * app, y la app esta pensada para 393 px de ancho en vertical con una barra de
 * estado encima. Escalada a 1080 se ve como lo que es: una captura de pantalla.
 * Dibujando aparte se compone PARA el chat, con la cifra a un tamano que se lee
 * en la vista previa de una conversacion.
 *
 * REGLA DE COMPOSICION: manda UNA cosa. La cifra ocupa el centro y todo lo
 * demas la rodea. Quien recibe la imagen la mira dos segundos entre otros
 * veinte mensajes; si tiene que elegir donde mirar, no mira.
 *
 * DETERMINISTA: mismos datos, mismos pixeles. No hay azar ni hora ni medidas
 * del dispositivo, asi que una prueba puede comparar dos renders y el resultado
 * es estable.
 */
import type { Momento } from '../meta/compartir';

export const ANCHO = 1080;
export const ALTO = 1350;

/** Margen lateral. Todo lo que no sea fondo vive dentro de esta caja. */
const MARGEN = 96;

/** 0,92: por debajo empiezan a verse restos alrededor de las letras grandes. */
const CALIDAD_JPEG = 0.92;

export interface PosterOptions {
  /** Codigo del grupo, si se quiere la puerta de entrada al pie. */
  codigoGrupo?: string | null;
}

/**
 * Pinta el momento y devuelve el lienzo.
 *
 * Se expone el lienzo (y no solo el PNG) para poder comprobarlo pixel a pixel
 * en las pruebas sin pasar por la codificacion.
 */
export function dibujarPoster(momento: Momento, options: PosterOptions = {}): HTMLCanvasElement {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no da contexto 2D: no se puede dibujar el poster');

  fondo(ctx, momento.color);
  marco(ctx, momento.color);

  let y = MARGEN + 118;
  y = cabecera(ctx, momento, y);
  y = bloqueCifra(ctx, momento, y);
  y = bloqueComparativa(ctx, momento, y);
  remate(ctx, momento, y);
  pie(ctx, options.codigoGrupo ?? null);

  return lienzo;
}

/** El PNG, listo para compartir o descargar. */
export async function posterComoBlob(
  momento: Momento,
  options: PosterOptions = {},
): Promise<Blob> {
  const lienzo = dibujarPoster(momento, options);
  const blob = await new Promise<Blob | null>((resolve) => {
    // JPEG y no PNG: el fondo son degradados suaves, que es justo lo que peor
    // comprime PNG. Medido sobre el mismo poster: PNG 1.563 kB, JPEG al 0,92
    // 125 kB, y visualmente no se distingue uno de otro. Mandar millon y medio
    // por WhatsApp cada vez que alguien gana no es aceptable.
    //
    // Tampoco WebP, que sale aun mas pequeno (51 kB): WhatsApp trata los WebP
    // como pegatinas en algunas plataformas, y una pegatina no es lo que se
    // quiere mandar. JPEG entra como imagen en todas partes.
    lienzo.toBlob((b) => resolve(b), 'image/jpeg', CALIDAD_JPEG);
  });
  if (!blob) throw new Error('No se ha podido codificar el poster');
  return blob;
}

/** Nombre de fichero estable y sin acentos, para el menu del sistema. */
export function nombreDeFichero(momento: Momento): string {
  return `playzone-${momento.tipo}.jpg`;
}

export const TIPO_MIME = 'image/jpeg';

/* -------------------------------------------------------------------- */
/* Piezas                                                                */
/* -------------------------------------------------------------------- */

/**
 * Grafito azulado con dos focos de luz: el color del momento arriba a la
 * derecha y un violeta al pie. Es el mismo suelo que la app, asi que el poster
 * se reconoce como del juego sin llevar el logo enorme.
 */
function fondo(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = '#05060e';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  focoRadial(ctx, ANCHO * 0.78, ALTO * 0.12, ANCHO * 0.95, color, 0.3);
  focoRadial(ctx, ANCHO * 0.1, ALTO * 0.86, ANCHO * 0.85, '#8b5cf6', 0.2);
  focoRadial(ctx, ANCHO * 0.5, ALTO * 0.46, ANCHO * 0.75, color, 0.09);

  // Un velo oscuro por encima para que el texto blanco siempre tenga contraste
  // por mucho que el color del juego sea claro (la lima de RITMO, por ejemplo).
  const velo = ctx.createLinearGradient(0, 0, 0, ALTO);
  velo.addColorStop(0, 'rgba(5, 6, 14, 0.34)');
  velo.addColorStop(0.5, 'rgba(5, 6, 14, 0.5)');
  velo.addColorStop(1, 'rgba(5, 6, 14, 0.66)');
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
}

function focoRadial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radio: number,
  color: string,
  alfa: number,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
  g.addColorStop(0, conAlfa(color, alfa));
  g.addColorStop(1, conAlfa(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);
}

/** Filo luminoso del color del momento: encuadra sin tapar. */
function marco(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.save();
  ctx.strokeStyle = conAlfa(color, 0.42);
  ctx.lineWidth = 4;
  redondeado(ctx, 30, 30, ANCHO - 60, ALTO - 60, 44);
  ctx.stroke();
  ctx.restore();
}

/** Emoji, titular y donde ha pasado. */
function cabecera(ctx: CanvasRenderingContext2D, m: Momento, y: number): number {
  if (m.emoji) {
    ctx.textAlign = 'center';
    ctx.font = '96px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(m.emoji, ANCHO / 2, y);
    y += 96;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  // El titular se encoge si hace falta: "5 DÍAS MANDANDO" y "HA ROBADO EL #1"
  // no miden lo mismo, y una linea partida arruina la composicion.
  const tam = ajustarTexto(ctx, m.titulo, ANCHO - MARGEN * 2, 78, 'italic 900', 44);
  ctx.font = fuente(tam, 900, true);
  ctx.fillText(m.titulo, ANCHO / 2, y + tam * 0.34);
  y += tam * 0.9 + 26;

  ctx.font = fuente(26, 800);
  ctx.fillStyle = conAlfa(m.color, 0.95);
  ctx.letterSpacing = '6px';
  ctx.fillText(m.donde.toUpperCase(), ANCHO / 2, y);
  ctx.letterSpacing = '0px';
  return y + 54;
}

/** La cifra. Es lo unico que se ve si la imagen sale pequena en el chat. */
function bloqueCifra(ctx: CanvasRenderingContext2D, m: Momento, y: number): number {
  ctx.textAlign = 'center';
  const tam = ajustarTexto(ctx, m.cifra, ANCHO - MARGEN * 2 - 40, 250, '900', 110);

  // Halo del color del momento por detras de la cifra.
  ctx.save();
  ctx.shadowColor = conAlfa(m.color, 0.75);
  ctx.shadowBlur = 68;
  ctx.fillStyle = '#ffffff';
  ctx.font = fuente(tam, 900);
  const baseY = y + tam * 0.74;
  ctx.fillText(m.cifra, ANCHO / 2, baseY);
  ctx.restore();

  // Se repinta sin sombra: el halo tine el borde y esto devuelve el blanco
  // limpio en el centro de las letras.
  ctx.fillStyle = '#ffffff';
  ctx.font = fuente(tam, 900);
  ctx.fillText(m.cifra, ANCHO / 2, baseY);

  y = baseY + 46;
  ctx.font = fuente(28, 800);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.66)';
  ctx.letterSpacing = '7px';
  ctx.fillText(m.cifraPie.toUpperCase(), ANCHO / 2, y);
  ctx.letterSpacing = '0px';
  return y + 60;
}

/**
 * Las dos filas del medio.
 *
 * Es la parte que hace entendible el poster a alguien que no ha jugado nunca:
 * dos etiquetas, dos numeros, y quien esta arriba manda. Sirve igual para "yo
 * contra Marc" que para "antes y despues de la apuesta", asi que ningun poster
 * se queda con un hueco vacio en medio por no tener rival.
 */
function bloqueComparativa(ctx: CanvasRenderingContext2D, m: Momento, y: number): number {
  const c = m.comparativa;
  if (!c) return y;

  const alto = 96;
  const ancho = ANCHO - MARGEN * 2;
  const filas: [string, string, boolean][] = [
    [c.etiquetaA, c.cifraA, true],
    [c.etiquetaB, c.cifraB, false],
  ];
  // La diferencia va PEGADA entre las dos filas, en el lado derecho. Es el
  // numero que escuece: sin el hay que restar 6.482 menos 6.464 a mano para
  // saber si la cosa estuvo apretada o fue una paliza.
  const yDiferencia = y + alto + 7;

  for (const [etiqueta, cifra, esMio] of filas) {
    ctx.save();
    ctx.fillStyle = esMio ? conAlfa(m.color, 0.2) : 'rgba(255, 255, 255, 0.05)';
    redondeado(ctx, MARGEN, y, ancho, alto, 22);
    ctx.fill();
    if (esMio) {
      ctx.strokeStyle = conAlfa(m.color, 0.5);
      ctx.lineWidth = 2.5;
      redondeado(ctx, MARGEN, y, ancho, alto, 22);
      ctx.stroke();
    }
    ctx.restore();

    // La cifra se dibuja primero para saber cuanto sitio deja a la etiqueta:
    // "FANTASMA DE BARTOLOMEO" y "SUPERADO" no pueden solaparse.
    ctx.textAlign = 'right';
    ctx.fillStyle = esMio ? '#ffffff' : 'rgba(255, 255, 255, 0.72)';
    const tamCifra = ajustarTexto(ctx, cifra, ancho * 0.42, 44, '900', 24);
    ctx.font = fuente(tamCifra, 900);
    const anchoCifra = ctx.measureText(cifra).width;
    ctx.fillText(cifra, ANCHO - MARGEN - 34, y + alto / 2 + tamCifra * 0.34);

    ctx.textAlign = 'left';
    ctx.fillStyle = esMio ? '#ffffff' : 'rgba(255, 255, 255, 0.72)';
    const sitio = ancho - 68 - anchoCifra - 28;
    const tamEtiqueta = ajustarTexto(ctx, etiqueta, sitio, 42, '900', 20);
    ctx.font = fuente(tamEtiqueta, 900);
    ctx.fillText(etiqueta, MARGEN + 34, y + alto / 2 + tamEtiqueta * 0.35);

    y += alto + 14;
  }

  if (c.diferencia) {
    ctx.font = fuente(34, 900);
    const anchoTexto = ctx.measureText(c.diferencia).width;
    const cajaAncho = anchoTexto + 44;
    const x = ANCHO - MARGEN - 34 - cajaAncho;
    ctx.save();
    ctx.fillStyle = conAlfa(m.color, 0.92);
    redondeado(ctx, x, yDiferencia - 25, cajaAncho, 50, 25);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#05060e';
    ctx.fillText(c.diferencia, x + cajaAncho / 2, yDiferencia + 12);
  }

  return y + 26;
}

/** La frase que provoca respuesta. */
function remate(ctx: CanvasRenderingContext2D, m: Momento, y: number): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = conAlfa(m.color, 1);
  const tam = ajustarTexto(ctx, m.remate, ANCHO - MARGEN * 2, 54, '900', 30);
  ctx.font = fuente(tam, 900);
  ctx.letterSpacing = '2px';
  // Anclado a una altura fija: asi el remate cae siempre en el mismo sitio
  // aunque el bloque de arriba mida distinto, y todos los posters se
  // reconocen como de la misma familia.
  ctx.fillText(m.remate, ANCHO / 2, Math.max(y + 40, ALTO - 232));
  ctx.letterSpacing = '0px';
}

/**
 * Marca y puerta de entrada.
 *
 * PLAYZONE RUSH va pequeno y al pie a proposito: el poster tiene que ser
 * interesante para quien lo recibe ANTES de ser publicidad. El codigo del
 * grupo se pone al lado, discreto, porque quien quiera entrar necesita saber
 * como; pero no es el protagonista.
 */
function pie(ctx: CanvasRenderingContext2D, codigo: string | null): void {
  const y = ALTO - 118;

  ctx.textAlign = 'center';
  ctx.font = fuente(30, 900);
  ctx.letterSpacing = '10px';
  const marca = 'PLAYZONE ';
  const rush = 'RUSH';
  const anchoMarca = ctx.measureText(marca).width;
  const anchoRush = ctx.measureText(rush).width;
  const x0 = (ANCHO - (anchoMarca + anchoRush)) / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fillText(marca, x0, y);
  ctx.fillStyle = '#ff2f6d';
  ctx.fillText(rush, x0 + anchoMarca, y);
  ctx.letterSpacing = '0px';

  if (codigo) {
    ctx.textAlign = 'center';
    ctx.font = fuente(23, 800);
    ctx.letterSpacing = '5px';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fillText(`ENTRA CON EL CÓDIGO ${codigo.toUpperCase()}`, ANCHO / 2, y + 46);
    ctx.letterSpacing = '0px';
  }
}

/* -------------------------------------------------------------------- */
/* Utilidades de dibujo                                                  */
/* -------------------------------------------------------------------- */

/** La misma familia que la app, con reserva del sistema. */
function fuente(tam: number, peso: number, cursiva = false): string {
  return `${cursiva ? 'italic ' : ''}${peso} ${Math.round(tam)}px Archivo, ui-sans-serif, system-ui, sans-serif`;
}

/**
 * Baja el cuerpo hasta que el texto quepa.
 *
 * Es lo que evita que el poster se rompa con un nombre como "ALEJANDRO" o con
 * una puntuacion de seis cifras. Nunca parte lineas: en una composicion asi,
 * dos lineas donde deberia haber una se ve peor que una linea mas pequena.
 */
function ajustarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoMax: number,
  tamMax: number,
  pesoOEstilo: string,
  tamMin: number,
): number {
  const cursiva = pesoOEstilo.includes('italic');
  const peso = Number(pesoOEstilo.replace('italic', '').trim()) || 900;
  let tam = tamMax;
  while (tam > tamMin) {
    ctx.font = fuente(tam, peso, cursiva);
    if (ctx.measureText(texto).width <= anchoMax) return tam;
    tam -= 2;
  }
  return tamMin;
}

function redondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** "#22d3ee" + 0.4 -> "rgba(34, 211, 238, 0.4)". */
export function conAlfa(hex: string, alfa: number): string {
  const limpio = hex.replace('#', '');
  const completo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio;
  const n = Number.parseInt(completo.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(255, 255, 255, ${alfa})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
