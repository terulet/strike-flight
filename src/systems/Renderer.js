/**
 * RENDERER — composición por capas.
 *
 * Todo el juego se apoya en una única idea: hay tres poblaciones visuales y
 * cada una obedece a una máscara distinta.
 *
 *   ESTÁTICA (geometría)   ← combinedMask   ambiente + luz + MEMORIA
 *   DINÁMICA (entidades)   ← liveMask       solo luz de AHORA
 *   EMISIVA  (luz propia)  ← ninguna        siempre visible
 *
 * Que la geometría use memoria y las entidades no es la regla de la que sale
 * la fantasía entera: recuerdas la habitación, no recuerdas al enemigo.
 *
 * El enmascarado se hace con `destination-in`: el alfa de la máscara
 * multiplica el alfa de la capa, así que "cuánta luz hay" y "cuánto se ve"
 * son literalmente el mismo número. Sin shaders y sin leer píxeles.
 */

import { Config } from '../config/Config.js';
import { rgba, clamp } from '../core/MathUtils.js';

/**
 * Paleta — estos son los colores del escenario TOTALMENTE ILUMINADO.
 *
 * Es el error fácil de este renderizador: pintar el suelo casi negro "porque
 * el juego es oscuro". La oscuridad ya la pone la máscara, que multiplica
 * esta capa; si además la capa nace negra, un fogonazo a plena potencia
 * revela un gris sucio y el destello no impresiona. Aquí se pinta la sala
 * como se vería con las luces encendidas, y se deja que la luz decida.
 *
 * Lo que sí importa es el CONTRASTE entre suelo y muro: es lo único que
 * permite leer una habitación en los 85 ms que dura un fogonazo.
 */
const FLOOR = '#1e2735';
const FLOOR_ALT = '#232d3d';
const FLOOR_PANEL = 'rgba(160,200,245,0.07)';
const WALL = '#41526d';
const WALL_TOP = '#7791b3';
const WALL_EDGE = '#bcd2ec';
const GRID = 'rgba(130,170,220,0.07)';
/** Oclusión ambiental falsa: sombra del muro sobre el suelo que toca. */
const AO = 'rgba(0,0,0,0.42)';
const AO_SIZE = 9;

/** Hash determinista por celda: el detalle del suelo no debe parpadear. */
function cellHash(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function makeLayer() {
  const c = document.createElement('canvas');
  return { canvas: c, ctx: c.getContext('2d') };
}

export class Renderer {
  constructor(canvas, level) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = level;

    this.staticL = makeLayer();
    this.dynL = makeLayer();
    this.emisL = makeLayer();
    this.comp = makeLayer();

    this.viewW = 0;
    this.viewH = 0;
    this.dpr = 1;
    this.grainPattern = null;
    this.vignette = null;
  }

  /**
   * @param {number} cssW,cssH  tamaño en píxeles CSS
   * @returns {boolean} true si cambió el tamaño
   */
  resize(cssW, cssH, deviceRatio) {
    const R = Config.render;
    let dpr = Math.min(deviceRatio || 1, R.dprCap);
    // Techo de píxeles: en pantallas grandes bajamos densidad antes que fps.
    const pixels = cssW * cssH * dpr * dpr;
    if (pixels > R.maxPixels) dpr *= Math.sqrt(R.maxPixels / pixels);

    if (this.viewW === cssW && this.viewH === cssH && Math.abs(this.dpr - dpr) < 1e-6) return false;
    this.viewW = cssW;
    this.viewH = cssH;
    this.dpr = dpr;

    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    for (const layer of [this.staticL, this.dynL, this.emisL, this.comp]) {
      layer.canvas.width = w;
      layer.canvas.height = h;
      // Base en píxeles CSS: todo el juego dibuja en un solo sistema de
      // coordenadas y la densidad de pantalla deja de ser su problema.
      layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layer.ctx.imageSmoothingEnabled = true;
    }
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#buildGrain();
    this.#buildVignette();
    return true;
  }

  /**
   * Grano: textura de ruido con alfa variable, servida como PATRÓN.
   *
   * La primera versión embaldosaba la pantalla con ~90 drawImage en modo
   * 'overlay' y costaba sola más que el resto del fotograma junto. Un patrón
   * es un único fillRect, y el ruido con alfa evita el modo de fusión caro:
   * mismo resultado, dos órdenes de magnitud menos.
   */
  #buildGrain() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v < 0.5 ? 0 : 255;
      img.data[i + 3] = Math.random() * 255;
    }
    g.putImageData(img, 0, 0);
    this.grainPattern = this.comp.ctx.createPattern(c, 'repeat');
  }

  /**
   * Viñeta pregenerada a baja resolución y estirada.
   *
   * Es un degradado enorme y suave: a 256 px no se distingue del original, y
   * un blit escalado cuesta mucho menos que rellenar la pantalla con un
   * gradiente radial cada fotograma.
   */
  #buildVignette() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.vignette = c;
  }

  clearLayers() {
    for (const l of [this.staticL, this.dynL, this.emisL]) {
      l.ctx.save();
      l.ctx.setTransform(1, 0, 0, 1, 0, 0);
      l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
      l.ctx.restore();
    }
  }

  /**
   * Geometría visible. Se redibuja cada fotograma pero solo las celdas del
   * viewport (~400 en esta arena): más barato que mantener y blitear un
   * lienzo del nivel entero, y sin su coste de memoria en un móvil.
   */
  drawStatic(cam) {
    const ctx = this.staticL.ctx;
    const L = this.level;
    const t = L.tile;

    const x0 = Math.max(0, Math.floor(cam.x / t) - 1);
    const y0 = Math.max(0, Math.floor(cam.y / t) - 1);
    const x1 = Math.min(L.cols - 1, Math.ceil((cam.x + this.viewW) / t) + 1);
    const y1 = Math.min(L.rows - 1, Math.ceil((cam.y + this.viewH) / t) + 1);

    // Pasada 1 — planos. Suelo y muros, sin detalle.
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const sx = cx * t - cam.x;
        const sy = cy * t - cam.y;
        if (L.isSolidCell(cx, cy)) {
          ctx.fillStyle = WALL;
          ctx.fillRect(sx, sy, t, t);
          // Cara sur iluminada: falso volumen con un fillRect, sin normales.
          if (!L.isSolidCell(cx, cy + 1)) {
            ctx.fillStyle = WALL_TOP;
            ctx.fillRect(sx, sy + t - 8, t, 8);
          }
        } else {
          ctx.fillStyle = ((cx + cy) & 1) ? FLOOR : FLOOR_ALT;
          ctx.fillRect(sx, sy, t, t);
        }
      }
    }

    // Pasada 2 — detalle del suelo y oclusión contra los muros.
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (L.isSolidCell(cx, cy)) continue;
        const sx = cx * t - cam.x;
        const sy = cy * t - cam.y;
        ctx.moveTo(sx + 0.5, sy + 0.5);
        ctx.lineTo(sx + t - 0.5, sy + 0.5);
        ctx.moveTo(sx + 0.5, sy + 0.5);
        ctx.lineTo(sx + 0.5, sy + t - 0.5);
      }
    }
    ctx.stroke();

    // Placas sueltas: rompen la repetición del damero para que la luz al
    // barrer tenga en qué engancharse. Sin nada que revelar, un foco moviéndose
    // sobre un plano liso no se lee como movimiento.
    ctx.fillStyle = FLOOR_PANEL;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (L.isSolidCell(cx, cy)) continue;
        const h = cellHash(cx, cy);
        if (h > 0.14) continue;
        const sx = cx * t - cam.x;
        const sy = cy * t - cam.y;
        if (h < 0.05) {
          // Rejilla de ventilación.
          for (let i = 0; i < 4; i++) ctx.fillRect(sx + 9, sy + 12 + i * 7, t - 18, 3);
        } else {
          ctx.fillRect(sx + 6, sy + 6, t - 12, t - 12);
        }
      }
    }

    // Oclusión ambiental: el suelo se oscurece contra cada muro que toca.
    // Es el truco más rentable de todo el renderizador — cuatro fillRect por
    // celda y de golpe los muros dejan de parecer pegatinas.
    ctx.fillStyle = AO;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (L.isSolidCell(cx, cy)) continue;
        const sx = cx * t - cam.x;
        const sy = cy * t - cam.y;
        if (L.isSolidCell(cx, cy - 1)) ctx.fillRect(sx, sy, t, AO_SIZE);
        if (L.isSolidCell(cx, cy + 1)) ctx.fillRect(sx, sy + t - AO_SIZE, t, AO_SIZE);
        if (L.isSolidCell(cx - 1, cy)) ctx.fillRect(sx, sy, AO_SIZE, t);
        if (L.isSolidCell(cx + 1, cy)) ctx.fillRect(sx + t - AO_SIZE, sy, AO_SIZE, t);
      }
    }

    // Aristas de los muros: el borde brillante es lo que hace que la
    // geometría "salte" cuando pasa un fogonazo.
    ctx.strokeStyle = WALL_EDGE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const s of L.segments) {
      if (s.maxX < cam.x - 8 || s.minX > cam.x + this.viewW + 8) continue;
      if (s.maxY < cam.y - 8 || s.minY > cam.y + this.viewH + 8) continue;
      ctx.moveTo(s.ax - cam.x, s.ay - cam.y);
      ctx.lineTo(s.bx - cam.x, s.by - cam.y);
    }
    ctx.stroke();
  }

  /**
   * Composición final.
   *
   * Las capas se enmascaran EN SU PROPIO lienzo (`destination-in` sobre sí
   * mismas) en vez de copiarlas antes a un buffer temporal. Se redibujan
   * enteras cada fotograma, así que destruirlas no cuesta nada — y ahorra
   * cuatro barridos de pantalla completa, que en una GPU móvil es la
   * diferencia entre 60 y 40 fps.
   *
   * @param {Lighting} lighting  con las máscaras del fotograma ya construidas
   */
  compose(lighting, cam) {
    const W = this.viewW, H = this.viewH;
    const rolling = Math.abs(cam.roll) > 1e-5;
    // Sin giro se pinta directamente en pantalla: un barrido menos.
    const target = rolling ? this.comp.ctx : this.ctx;
    if (!rolling) target.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    target.globalCompositeOperation = 'source-over';
    target.globalAlpha = 1;
    target.fillStyle = '#000';
    target.fillRect(0, 0, W, H);

    // 1 · Geometría a través de ambiente + luz + memoria.
    const st = this.staticL.ctx;
    st.globalCompositeOperation = 'destination-in';
    st.drawImage(lighting.combinedMask, 0, 0, W, H);
    st.globalCompositeOperation = 'source-over';
    target.drawImage(this.staticL.canvas, 0, 0, W, H);

    // 2 · Entidades SOLO a través de la luz viva. Aquí vive el juego.
    const dy = this.dynL.ctx;
    dy.globalCompositeOperation = 'destination-in';
    dy.drawImage(lighting.liveMask, 0, 0, W, H);
    dy.globalCompositeOperation = 'source-over';
    target.drawImage(this.dynL.canvas, 0, 0, W, H);

    // 3 · La luz se suma a lo que ya ilumina: de ahí el color y el brillo.
    target.globalCompositeOperation = 'lighter';
    target.globalAlpha = clamp(Config.lighting.bloom, 0, 1);
    target.drawImage(lighting.combinedMask, 0, 0, W, H);
    target.globalAlpha = 1;

    // 4 · Emisiva: proyectiles, chispas, ojos, silueta. No los tapa nada.
    target.drawImage(this.emisL.canvas, 0, 0, W, H);
    target.globalCompositeOperation = 'source-over';

    this.#postFx(target, W, H);
    if (rolling) this.#present(cam);
  }

  #postFx(ctx, W, H) {
    const R = Config.render;
    if (R.vignette > 0 && this.vignette) {
      ctx.globalAlpha = clamp(R.vignette, 0, 1);
      ctx.drawImage(this.vignette, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (R.grain > 0 && this.grainPattern) {
      // Un solo fillRect. El desplazamiento aleatorio hace que 256 px de
      // ruido parezcan infinitos y que el grano no se quede "pegado".
      ctx.save();
      ctx.globalAlpha = clamp(R.grain, 0, 1);
      ctx.translate(-Math.floor(Math.random() * 256), -Math.floor(Math.random() * 256));
      ctx.fillStyle = this.grainPattern;
      ctx.fillRect(0, 0, W + 256, H + 256);
      ctx.restore();
    }
  }

  /** Vuelca el resultado a pantalla. El giro de la sacudida se aplica aquí. */
  #present(cam) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    if (Math.abs(cam.roll) > 1e-5) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(cam.roll);
      // Un pelín de zoom para que al girar no asome el borde vacío.
      ctx.scale(1.05, 1.05);
      ctx.drawImage(this.comp.canvas, -w / 2, -h / 2);
      ctx.restore();
    } else {
      ctx.drawImage(this.comp.canvas, 0, 0);
    }
  }

  /** Farolas del nivel: dibujadas en emisiva y registradas como luz real. */
  drawLamps(cam, lamps, time) {
    const ctx = this.emisL.ctx;
    for (const l of lamps) {
      const sx = l.x - cam.x, sy = l.y - cam.y;
      if (sx < -40 || sy < -40 || sx > this.viewW + 40 || sy > this.viewH + 40) continue;
      const f = l.flicker;
      ctx.fillStyle = rgba([1.0, 0.62, 0.30], 0.5 + f * 0.45);
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }
  }
}
