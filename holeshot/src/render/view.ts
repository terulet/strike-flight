/**
 * Camara y transformaciones. El mundo usa metros con la Y hacia ARRIBA; la
 * transformacion del mundo ya invierte el eje, asi que la moto, el terreno y
 * los decorados se dibujan en metros sin pensar en pixeles.
 */
import { clamp } from '../core/math';

export interface View {
  /** Tamano del lienzo en pixeles CSS. */
  W: number;
  H: number;
  dpr: number;
  /** Pixeles por metro. */
  ppm: number;
  /** Centro de la camara en el mundo (metros). */
  cx: number;
  cy: number;
  /** Rango visible en X (metros). */
  x0: number;
  x1: number;
  /** Borde inferior visible (metros). */
  yBottom: number;
  yTop: number;
}

export function worldTransform(ctx: CanvasRenderingContext2D, v: View): void {
  const s = v.ppm * v.dpr;
  ctx.setTransform(s, 0, 0, -s, (v.W / 2 - v.cx * v.ppm) * v.dpr, (v.H / 2 + v.cy * v.ppm) * v.dpr);
}

export function screenTransform(ctx: CanvasRenderingContext2D, v: View): void {
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
}

export function toScreen(v: View, x: number, y: number): { x: number; y: number } {
  return { x: (x - v.cx) * v.ppm + v.W / 2, y: v.H / 2 - (y - v.cy) * v.ppm };
}

export interface CameraTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Altura sobre el suelo, para abrir plano en los saltos grandes. */
  height: number;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  /** Zoom fijo (solo para inspeccionar el arte con ?zoom=N). */
  fixedZoom = 0;
  /** Plano de cine (0..1): acerca la camara en la camara lenta. */
  cinema = 0;
  /** Clip vertical: el piloto siempre centrado, sin adelantar el plano. */
  portrait = false;
  private trauma = 0;
  private time = 0;

  reset(t: CameraTarget): void {
    this.x = t.x + 4;
    this.y = t.y + 2.4;
    this.zoom = 1;
    this.trauma = 0;
  }

  /** Temblor de camara (0..1); se acumula y decae solo. */
  shake(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  update(dt: number, t: CameraTarget): void {
    this.time += dt;
    const speed = Math.hypot(t.vx, t.vy);
    const lookAhead = this.portrait ? clamp(t.vx * 0.06, -1, 1.5) : clamp(t.vx * 0.3, -3, 7.5);
    const high = Math.max(0, t.height - 1.2);
    const tx = t.x + lookAhead;
    // En el aire la camara baja un poco para enseñar donde vas a caer.
    const ty = this.portrait ? t.y + 0.6 - Math.min(high * 0.3, 3.5) : t.y + 2.4 - Math.min(high * 0.4, 5) + clamp(t.vy * 0.08, -1.6, 0.8);
    const kx = 1 - Math.exp(-dt * 5.5);
    const ky = 1 - Math.exp(-dt * 3.8);
    this.x += (tx - this.x) * kx;
    this.y += (ty - this.y) * ky;
    const tz = 1 + clamp((speed - 10) / 45, 0, 0.28) + clamp(high / 12, 0, 0.5);
    this.zoom += (tz - this.zoom) * (1 - Math.exp(-dt * 1.6));
    if (this.fixedZoom > 0) this.zoom = this.fixedZoom;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  view(W: number, H: number, dpr: number): View {
    // Paisaje: ~13.5 m de alto. Retrato: al menos ~22 m de ancho.
    const ppm = Math.min(H / 13.5, W / 22) / (this.zoom * (1 - 0.22 * this.cinema));
    const s = this.trauma * this.trauma;
    const sx = s * 0.55 * (Math.sin(this.time * 47.3) + Math.sin(this.time * 31.1) * 0.5);
    const sy = s * 0.55 * (Math.sin(this.time * 53.7 + 1.3) + Math.sin(this.time * 23.9) * 0.5);
    const cx = this.x + sx;
    const cy = this.y + sy;
    const halfW = W / 2 / ppm;
    const halfH = H / 2 / ppm;
    return { W, H, dpr, ppm, cx, cy, x0: cx - halfW, x1: cx + halfW, yBottom: cy - halfH, yTop: cy + halfH };
  }
}
