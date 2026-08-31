/**
 * TerrainPainter.ts
 *
 * Dibuja el suelo a partir de la MISMA curva contra la que se choca.
 *
 * Lo que habia antes era un poligono relleno con un degradado vertical y una
 * linea clara encima. Eso, en pantalla, es una franja oscura pegada sobre el
 * paisaje: no tiene volumen, no tiene materia y no se entiende donde acaba el
 * suelo y empieza el fondo.
 *
 * Aqui el suelo se construye por capas, todas derivadas de `terrain.surfaceY`:
 *
 *   1. Estratos. Cuatro bandas de tierra a profundidades fijas, siguiendo el
 *      contorno. Como son horizontales -que es como se depositan de verdad-,
 *      un corte del terreno se lee como un corte de tierra y no como el borde
 *      de una carretera.
 *   2. Capa de tierra suelta. Una banda fina PERPENDICULAR a la superficie,
 *      mas clara y calida, que envuelve la cresta.
 *   3. Sombreado por pendiente. Cada tramo se oscurece segun cuanto se aparta
 *      su normal de la luz. Es lo que da forma a taludes y rampas: una cara
 *      que mira al sol y otra que no.
 *   4. Oclusion en los valles. Donde el terreno es concavo, un oscurecimiento
 *      suave. Es la sombra de contacto que pide el mandato, y ademas explica
 *      de un vistazo donde estan las compresiones.
 *   5. Huellas. Dos roderas discontinuas siguiendo la superficie: la pista
 *      esta usada, no recien fresada.
 *   6. Cresta iluminada, piedras y matojos, todos apoyados EXACTAMENTE en la
 *      curva de colision.
 *
 * Nada de esto es un sprite estirado por encima. Por construccion, lo que se
 * ve es donde se choca.
 */

import { Terrain } from '../physics/Terrain';
import { CameraPose } from './Camera';
import { Vec2 } from '../physics/MathUtils';

export interface SurfaceSample {
  x: number;
  y: number;
  slope: number;
  screen: { x: number; y: number };
}

/** Paleta de la tierra, de la superficie hacia abajo. */
export const GROUND_PALETTE = {
  looseTop: '#c98f57',
  looseTopShadow: '#7d5130',
  strata: [
    { depth: 0.0, color: '#9c6339' },
    { depth: 0.75, color: '#7d4e2f' },
    { depth: 1.9, color: '#5f3a25' },
    { depth: 4.2, color: '#452a1b' },
    { depth: 9.0, color: '#2e1c12' },
  ],
  rimLight: '#ffd39a',
  rimShade: 'rgba(40, 24, 14, 0.6)',
  rut: 'rgba(52, 32, 18, 0.26)',
  pebble: 'rgba(70, 48, 30, 0.7)',
  pebbleLit: 'rgba(226, 186, 138, 0.4)',
  grainDark: 'rgba(58, 36, 20, 0.30)',
  grainLight: 'rgba(240, 205, 160, 0.24)',
  scrub: '#5c6b3e',
  scrubDry: '#8a7a45',
} as const;

/** Direccion de la luz, en mundo. Coincide con el sol bajo del fondo. */
const LIGHT_DIRECTION: Vec2 = { x: -0.55, y: 0.835 };

/** Ruido determinista: el mismo x da siempre la misma piedra. */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Altura de la superficie en `x`, tomada de las muestras ya calculadas. */
function terrainYAt(samples: SurfaceSample[], x: number, startX: number, endX: number): number {
  if (endX <= startX) return samples[0].y;
  const t = (x - startX) / (endX - startX);
  const index = Math.min(samples.length - 1, Math.max(0, Math.round(t * (samples.length - 1))));
  return samples[index].y;
}

export class TerrainPainter {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /**
   * Muestrea la superficie visible. Un punto por pixel: mas es tirar tiempo,
   * menos y las crestas se ven poligonales.
   */
  sampleSurface(
    camera: CameraPose,
    terrain: Terrain,
    canvasWidth: number,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): SurfaceSample[] {
    const halfWidthMeters = canvasWidth / 2 / camera.pixelsPerMeter;
    const startX = Math.max(terrain.startX, camera.x - halfWidthMeters - 3);
    const endX = Math.min(terrain.endX, camera.x + halfWidthMeters + 3);
    const step = Math.max(0.05, 1 / camera.pixelsPerMeter);

    const samples: SurfaceSample[] = [];
    for (let x = startX; x <= endX; x += step) {
      const y = terrain.surfaceY(x);
      samples.push({ x, y, slope: terrain.surfaceSlope(x), screen: toScreen(x, y) });
    }
    if (samples.length > 0 && samples[samples.length - 1].x < endX) {
      const y = terrain.surfaceY(endX);
      samples.push({ x: endX, y, slope: terrain.surfaceSlope(endX), screen: toScreen(endX, y) });
    }
    return samples;
  }

  /** Camino cerrado entre la superficie y una copia desplazada por debajo. */
  private bandPath(
    samples: SurfaceSample[],
    topOffset: (sample: SurfaceSample) => number,
    bottomOffset: (sample: SurfaceSample) => number,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const p = toScreen(s.x, s.y - topOffset(s));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let i = samples.length - 1; i >= 0; i--) {
      const s = samples[i];
      const p = toScreen(s.x, s.y - bottomOffset(s));
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  /**
   * Estratos: bandas de tierra a profundidad constante bajo la superficie.
   * Se dibujan de la mas profunda a la mas somera para que cada una tape a la
   * anterior sin costuras.
   */
  private drawStrata(
    samples: SurfaceSample[],
    canvasHeight: number,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    const { ctx } = this;
    const strata = GROUND_PALETTE.strata;

    // Base: todo lo que hay por debajo de la ultima banda.
    ctx.beginPath();
    ctx.moveTo(samples[0].screen.x, samples[0].screen.y);
    for (const s of samples) ctx.lineTo(s.screen.x, s.screen.y);
    ctx.lineTo(samples[samples.length - 1].screen.x, canvasHeight);
    ctx.lineTo(samples[0].screen.x, canvasHeight);
    ctx.closePath();
    ctx.fillStyle = strata[strata.length - 1].color;
    ctx.fill();

    // Las bandas ondulan: un estrato perfectamente paralelo a la superficie
    // delata que es un truco de dibujo. La ondulacion es funcion de x, asi que
    // esta clavada al mundo y no se desliza con la camara.
    const wobble = (depth: number, x: number): number =>
      depth + Math.sin(x * 0.085 + depth) * depth * 0.16 + Math.sin(x * 0.23 + depth * 2.1) * depth * 0.07;

    for (let i = strata.length - 2; i >= 0; i--) {
      const top = strata[i].depth;
      const bottom = strata[i + 1].depth;
      this.bandPath(
        samples,
        (sample) => (top === 0 ? 0 : wobble(top, sample.x)),
        (sample) => wobble(bottom, sample.x),
        toScreen,
      );
      ctx.fillStyle = strata[i].color;
      ctx.fill();
    }
  }

  /**
   * Sombreado por pendiente sobre la banda de tierra suelta.
   *
   * Cada tramo se pinta por separado con la luminosidad que le corresponde
   * segun su normal. Es lo que convierte una silueta plana en un talud con
   * cara iluminada y cara en sombra.
   */
  private drawSlopeShading(
    samples: SurfaceSample[],
    thickness: number,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    const { ctx } = this;
    const chunk = 6; // tramos de 6 muestras: suficiente resolucion, pocos draws
    for (let i = 0; i + chunk < samples.length; i += chunk) {
      const slice = samples.slice(i, i + chunk + 1);
      const mid = slice[Math.floor(slice.length / 2)];
      const length = Math.hypot(1, mid.slope);
      const normal = { x: -mid.slope / length, y: 1 / length };
      const lambert = normal.x * LIGHT_DIRECTION.x + normal.y * LIGHT_DIRECTION.y;
      // 0 = cara de espaldas a la luz, 1 = de frente.
      const lit = Math.max(0, Math.min(1, (lambert + 0.35) / 1.2));

      ctx.beginPath();
      for (let k = 0; k < slice.length; k++) {
        const p = slice[k].screen;
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      for (let k = slice.length - 1; k >= 0; k--) {
        const s = slice[k];
        const p = toScreen(s.x, s.y - thickness);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = lit > 0.5 ? GROUND_PALETTE.looseTop : GROUND_PALETTE.looseTopShadow;
      ctx.globalAlpha = 0.55 + Math.abs(lit - 0.5) * 0.9;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Oclusion en los valles: donde el terreno es concavo se acumula sombra.
   * La curvatura se estima con la diferencia de pendiente entre muestras
   * separadas, que es barato y suficiente.
   */
  private drawConcaveOcclusion(
    samples: SurfaceSample[],
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    const { ctx } = this;
    const span = 8;
    const depth = 0.9;
    for (let i = span; i < samples.length - span; i += 4) {
      const curvature = (samples[i + span].slope - samples[i - span].slope) / (samples[i + span].x - samples[i - span].x);
      if (curvature <= 0.02) continue;
      const strength = Math.min(0.42, curvature * 0.5);
      const a = samples[i - 2];
      const b = samples[i + 2];
      const top = a.screen;
      const gradient = ctx.createLinearGradient(top.x, top.y, top.x, toScreen(a.x, a.y - depth).y);
      gradient.addColorStop(0, `rgba(38, 24, 14, ${strength})`);
      gradient.addColorStop(1, 'rgba(38, 24, 14, 0)');
      ctx.beginPath();
      ctx.moveTo(a.screen.x, a.screen.y);
      ctx.lineTo(b.screen.x, b.screen.y);
      ctx.lineTo(toScreen(b.x, b.y - depth).x, toScreen(b.x, b.y - depth).y);
      ctx.lineTo(toScreen(a.x, a.y - depth).x, toScreen(a.x, a.y - depth).y);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  /**
   * Grano de la tierra suelta: motas claras y oscuras justo bajo la cresta.
   * Sin esto, la banda superior es un color plano y el suelo parece papel.
   * La posicion sale de un hash de x, asi que las motas se quedan quietas en
   * el mundo mientras la camara pasa por encima.
   */
  private drawTopsoilGrain(
    samples: SurfaceSample[],
    camera: CameraPose,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    const { ctx } = this;
    if (samples.length === 0) return;
    const startX = samples[0].x;
    const endX = samples[samples.length - 1].x;
    const ppm = camera.pixelsPerMeter;
    const spacing = 0.14;
    const first = Math.floor(startX / spacing) * spacing;

    for (let wx = first; wx <= endX; wx += spacing) {
      const roll = hash(wx * 17.3);
      if (roll < 0.42) continue;
      const depth = 0.03 + hash(wx * 5.1) * 0.26;
      const size = Math.max(0.7, (0.012 + hash(wx * 9.4) * 0.02) * ppm);
      const p = toScreen(wx, terrainYAt(samples, wx, startX, endX) - depth);
      ctx.fillStyle = roll > 0.72 ? GROUND_PALETTE.grainLight : GROUND_PALETTE.grainDark;
      ctx.fillRect(p.x, p.y, size, size);
    }
  }

  /** Roderas: dos lineas discontinuas justo bajo la cresta. */
  private drawRuts(
    samples: SurfaceSample[],
    camera: CameraPose,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = GROUND_PALETTE.rut;
    ctx.lineCap = 'round';
    for (const [depth, width] of [
      [0.07, 0.055],
      [0.15, 0.04],
    ] as const) {
      ctx.lineWidth = Math.max(1, width * camera.pixelsPerMeter);
      ctx.beginPath();
      let drawing = false;
      for (const s of samples) {
        // Discontinuidad en espacio de MUNDO: los trazos no se deslizan con la
        // camara, se quedan clavados en el suelo.
        const on = hash(Math.floor(s.x * 1.4)) > 0.28;
        const p = toScreen(s.x, s.y - depth);
        if (on && !drawing) {
          ctx.moveTo(p.x, p.y);
          drawing = true;
        } else if (on) {
          ctx.lineTo(p.x, p.y);
        } else {
          drawing = false;
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Cresta: linea clara arriba y sombra fina justo debajo. */
  private drawRim(samples: SurfaceSample[], camera: CameraPose, toScreen: (x: number, y: number) => { x: number; y: number }): void {
    const { ctx } = this;
    const trace = (offset: number) => {
      ctx.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const p = offset === 0 ? s.screen : toScreen(s.x, s.y - offset);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = GROUND_PALETTE.rimShade;
    ctx.lineWidth = Math.max(1.5, 0.045 * camera.pixelsPerMeter);
    trace(0.05);
    ctx.strokeStyle = GROUND_PALETTE.rimLight;
    ctx.lineWidth = Math.max(1.5, 0.03 * camera.pixelsPerMeter);
    trace(0);
    ctx.restore();
  }

  /** Piedras sueltas y matojos, apoyados exactamente en la curva. */
  private drawDebris(
    samples: SurfaceSample[],
    camera: CameraPose,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    const { ctx } = this;
    if (samples.length === 0) return;
    const startX = samples[0].x;
    const endX = samples[samples.length - 1].x;
    const ppm = camera.pixelsPerMeter;

    // Piedras: cada 0.8 m aproximadamente, con salto determinista.
    const spacing = 1.15;
    const first = Math.floor(startX / spacing) * spacing;
    for (let wx = first; wx <= endX; wx += spacing) {
      const roll = hash(wx * 3.11);
      if (roll < 0.62) continue;
      const jitter = (hash(wx * 7.7) - 0.5) * spacing * 0.8;
      const x = wx + jitter;
      if (x < startX || x > endX) continue;
      const index = Math.min(samples.length - 1, Math.max(0, Math.round(((x - startX) / (endX - startX)) * (samples.length - 1))));
      const s = samples[index];
      const size = (0.028 + hash(wx * 1.7) * 0.042) * ppm;
      const p = toScreen(s.x, s.y - size / ppm / 2);
      ctx.fillStyle = GROUND_PALETTE.pebble;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, size, size * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GROUND_PALETTE.pebbleLit;
      ctx.beginPath();
      ctx.ellipse(p.x - size * 0.25, p.y - size * 0.28, size * 0.45, size * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Matojos: solo en pendiente suave, o quedan pegados a una pared.
    const scrubSpacing = 6.5;
    const firstScrub = Math.floor(startX / scrubSpacing) * scrubSpacing;
    for (let wx = firstScrub; wx <= endX; wx += scrubSpacing) {
      if (hash(wx * 0.37) < 0.52) continue;
      const index = Math.min(samples.length - 1, Math.max(0, Math.round(((wx - startX) / (endX - startX)) * (samples.length - 1))));
      const s = samples[index];
      if (Math.abs(s.slope) > 0.5) continue;
      const scale = (0.1 + hash(wx) * 0.09) * ppm;
      ctx.strokeStyle = hash(wx * 5.3) > 0.5 ? GROUND_PALETTE.scrub : GROUND_PALETTE.scrubDry;
      ctx.lineWidth = Math.max(1, scale * 0.16);
      ctx.beginPath();
      for (const dir of [-1, -0.35, 0.35, 1]) {
        ctx.moveTo(s.screen.x, s.screen.y);
        ctx.lineTo(s.screen.x + dir * scale * 0.55, s.screen.y - scale);
      }
      ctx.stroke();
    }
  }

  /**
   * Pinta el suelo completo. `toScreen` es la misma proyeccion que usa el
   * resto del render, asi que la tierra y la moto no pueden desalinearse.
   */
  paint(
    camera: CameraPose,
    terrain: Terrain,
    canvasWidth: number,
    canvasHeight: number,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): SurfaceSample[] {
    const samples = this.sampleSurface(camera, terrain, canvasWidth, toScreen);
    if (samples.length < 2) return samples;

    this.drawStrata(samples, canvasHeight, toScreen);
    this.drawSlopeShading(samples, 0.34, toScreen);
    this.drawConcaveOcclusion(samples, toScreen);
    this.drawTopsoilGrain(samples, camera, toScreen);
    this.drawRuts(samples, camera, toScreen);
    this.drawRim(samples, camera, toScreen);
    this.drawDebris(samples, camera, toScreen);
    return samples;
  }
}
