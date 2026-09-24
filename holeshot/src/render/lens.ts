/**
 * Barro en la lente. Lo que te salpica (tus charcos y la tierra que escupe
 * la rueda del rival que llevas delante) se queda pegado a la pantalla y
 * chorrea poco a poco. Como en las gafas de motocross de verdad, se limpia
 * arrancando un tear-off: una lamina transparente que sale volando con todo
 * el barro. Hay pocos por carrera.
 */
import { makeRng } from '../core/math';
import { mix, rgba } from './color';

interface LensSplat {
  x: number;
  y: number;
  r: number;
  rot: number;
  sprite: number;
  drip: number;
  dripMax: number;
}

export const TEAR_OFFS = 5;

export class Lens {
  splats: LensSplat[] = [];
  private peeling: { splats: LensSplat[]; t: number } | null = null;
  left = TEAR_OFFS;
  private readonly sprites: HTMLCanvasElement[] = [];
  private readonly rnd = makeRng(99);

  constructor(private readonly color: string) {}

  /** Cuanto tapa el barro (0..1, aproximado). */
  get coverage(): number {
    let a = 0;
    for (const s of this.splats) a += s.r * s.r * 3;
    return Math.min(1, a);
  }

  hit(count: number, biasX = 0.5): void {
    for (let i = 0; i < count; i++) {
      if (this.splats.length > 46) this.splats.shift();
      const r = 0.025 + this.rnd() * this.rnd() * 0.09;
      this.splats.push({
        x: Math.min(0.98, Math.max(0.02, biasX + (this.rnd() - 0.5) * 0.8)),
        y: 0.1 + this.rnd() * 0.85,
        r,
        rot: this.rnd() * 6.28,
        sprite: Math.floor(this.rnd() * 3),
        drip: 0,
        dripMax: this.rnd() < 0.35 ? r * (0.6 + this.rnd() * 1.1) : 0,
      });
    }
  }

  tearOff(): boolean {
    if (this.left <= 0 || this.peeling || !this.splats.length) return false;
    this.left -= 1;
    this.peeling = { splats: this.splats, t: 0 };
    this.splats = [];
    return true;
  }

  get isPeeling(): boolean {
    return !!this.peeling;
  }

  update(dt: number): void {
    for (const s of this.splats) if (s.drip < s.dripMax) s.drip += dt * 0.012;
    if (this.peeling) {
      this.peeling.t += dt / 0.5;
      if (this.peeling.t >= 1) this.peeling = null;
    }
  }

  private sprite(i: number): HTMLCanvasElement {
    if (this.sprites[i]) return this.sprites[i];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const rnd = makeRng(1234 + i * 77);
    const dark = mix(this.color, '#1c120a', 0.3);
    const light = mix(this.color, '#d8b890', 0.25);
    // Gotas satelite.
    for (let k = 0; k < 10; k++) {
      const a = rnd() * 6.28;
      const d = 30 + rnd() * 30;
      g.fillStyle = rgba(dark, 0.55 + rnd() * 0.3);
      g.beginPath();
      g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1.5 + rnd() * 4, 0, 6.28);
      g.fill();
    }
    // Cuerpo irregular: bordes translucidos, centro opaco.
    for (let k = 0; k < 7; k++) {
      const ox = (rnd() - 0.5) * 34;
      const oy = (rnd() - 0.5) * 34;
      const r = 16 + rnd() * 16;
      const grad = g.createRadialGradient(64 + ox, 64 + oy, 0, 64 + ox, 64 + oy, r);
      grad.addColorStop(0, rgba(dark, 0.86));
      grad.addColorStop(0.6, rgba(this.color, 0.7));
      grad.addColorStop(1, rgba(this.color, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(64 + ox, 64 + oy, r, 0, 6.28);
      g.fill();
    }
    // Grumos y arenilla: textura de barro, no de tinta.
    for (let k = 0; k < 60; k++) {
      const a = rnd() * 6.28;
      const d = rnd() * 26;
      g.fillStyle = rnd() < 0.5 ? rgba(light, 0.5) : rgba(dark, 0.6);
      g.fillRect(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1.5 + rnd() * 2, 1.5 + rnd() * 2);
    }
    // Brillo humedo.
    g.fillStyle = 'rgba(255,240,220,0.35)';
    g.beginPath();
    g.ellipse(54, 52, 9, 4, -0.6, 0, 6.28);
    g.fill();
    this.sprites[i] = c;
    return c;
  }

  private drawSplats(ctx: CanvasRenderingContext2D, list: LensSplat[], W: number, H: number): void {
    const S = Math.min(W, H);
    for (const s of list) {
      const x = s.x * W;
      const y = s.y * H;
      const r = s.r * S * 1.6;
      if (s.drip > 0) {
        const len = s.drip * S * 1.6;
        const g = ctx.createLinearGradient(0, y, 0, y + len + r * 0.3);
        g.addColorStop(0, rgba(this.color, 0.65));
        g.addColorStop(1, rgba(this.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.16, y);
        ctx.quadraticCurveTo(x - r * 0.1, y + len * 0.7, x, y + len + r * 0.25);
        ctx.quadraticCurveTo(x + r * 0.1, y + len * 0.7, x + r * 0.16, y);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.rot);
      ctx.drawImage(this.sprite(s.sprite), -r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }

  draw(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    this.drawSplats(ctx, this.splats, W, H);
    if (this.peeling) {
      const t = this.peeling.t;
      const e = t * t;
      ctx.save();
      ctx.translate(-e * W * 1.1, -e * H * 0.25);
      ctx.rotate(-e * 0.35);
      ctx.globalAlpha = 1 - t * 0.4;
      // La lamina: plastico transparente con reflejo en el borde.
      ctx.fillStyle = 'rgba(220,235,255,0.07)';
      ctx.fillRect(0, 0, W, H);
      const sheen = ctx.createLinearGradient(W - 40, 0, W, 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.35)');
      ctx.fillStyle = sheen;
      ctx.fillRect(W - 40, 0, 40, H);
      this.drawSplats(ctx, this.peeling.splats, W, H);
      ctx.restore();
    }
  }
}
