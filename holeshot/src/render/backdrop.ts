/**
 * Fondo: cielo, sol o estrellas, nubes y tres planos de siluetas con
 * paralaje (mesetas, montañas, pinares, dunas, cantera, ciudad, estadio),
 * cada uno con su luz de borde y la bruma que da profundidad.
 */
import { clamp, hash1, noise1 } from '../core/math';
import { BackdropLayer, LayerKind, Theme } from '../game/missions';
import { mix } from './color';
import { View } from './view';

const frac = (v: number): number => v - Math.floor(v);

interface Strip {
  canvas: HTMLCanvasElement;
  W: number;
  H: number;
  tMin: number;
  scale: number;
  heightCss: number;
}
const ease = (u: number): number => u * u * (3 - 2 * u);
const ridge = (t: number): number => 1 - Math.abs(2 * noise1(t) - 1);

/** Perfil 0..1 de cada tipo de silueta. `t` en unidades del plano. */
export function profile(kind: LayerKind, t: number, seed: number): number {
  const s = seed * 37.1;
  switch (kind) {
    case 'mesas': {
      const u = t * 1.5 + s;
      const m = ease(Math.min(1, Math.max(0, (noise1(u * 1.3) - 0.52) / 0.05)));
      const top = 0.6 + 0.4 * noise1(u * 0.31 + 7);
      const erosion = (noise1(u * 11) - 0.5) * 0.05;
      return 0.1 + 0.08 * noise1(u * 2.3) + m * (top + erosion);
    }
    case 'cliffs': {
      const u = t * 2 + s;
      const h = 0.5 * noise1(u * 0.8) + 0.3 * noise1(u * 2.4) + 0.2 * noise1(u * 7.3);
      return Math.pow(h, 1.4) * 1.25;
    }
    case 'mountains': {
      const u = t * 1.1 + s;
      return 0.62 * ridge(u) + 0.28 * ridge(u * 2.2) + 0.1 * ridge(u * 5.3);
    }
    case 'hills': {
      const u = t * 1.1 + s;
      return 0.55 * noise1(u) + 0.3 * noise1(u * 2.3) + 0.15 * noise1(u * 5.1);
    }
    case 'dunes': {
      const u = t * 1.4 + s + 0.35 * noise1(t * 0.6 + s);
      const cell = Math.floor(u);
      const f = frac(u);
      const a = 0.45 + 0.55 * hash1(cell + s);
      const shape = f < 0.72 ? ease(f / 0.72) : 1 - ease((f - 0.72) / 0.28);
      return 0.12 + a * shape * 0.85;
    }
    case 'pines': {
      const base = 0.16 + 0.18 * noise1(t * 1.2 + s);
      const w = 0.055;
      const u = t / w + s;
      const cell = Math.floor(u);
      const f = frac(u);
      const th = 0.4 + 0.6 * hash1(cell * 1.7 + s);
      const tri = Math.max(0, 1 - Math.abs(f - 0.5) * 2);
      // Copa en pisos: dientes de sierra que se ensanchan hacia abajo.
      const tiers = Math.pow(tri, 0.8) * (0.82 + 0.18 * frac(tri * 3.6));
      return base + th * tiers * 0.85;
    }
    case 'quarry': {
      const n = 0.25 + 0.75 * noise1(t * 0.9 + s);
      const k = n * 5;
      const step = Math.floor(k);
      return (step + ease(Math.min(1, frac(k) * 3.5)) * 0.9 + frac(k) * 0.1) / 5;
    }
    case 'city': {
      const w = 0.045;
      const u = t / w + s;
      const cell = Math.floor(u);
      const f = frac(u);
      const h = 0.25 + 0.75 * Math.pow(hash1(cell * 3.1 + s), 1.6);
      const gap = f < 0.08 ? 0 : 1;
      const antenna = hash1(cell * 5.3) > 0.8 && Math.abs(f - 0.5) < 0.04 ? 0.12 : 0;
      return 0.08 + gap * h * 0.9 + antenna;
    }
    case 'stadium': {
      const period = 2.2;
      const f = frac(t / period + s);
      if (f < 0.08) return 0.12;
      if (f < 0.12) return 0.12 + ((f - 0.08) / 0.04) * 0.5;
      if (f < 0.82) return 0.62 + ((f - 0.12) / 0.7) * 0.3;
      if (f < 0.86) return 0.98;
      return 0.3;
    }
  }
}

export class Backdrop {
  private readonly clouds: Array<{ x: number; y: number; w: number; seed: number }>;
  private readonly stars: Array<{ x: number; y: number; r: number; tw: number }>;

  private readonly cloudColor: string;

  private sky: { canvas: HTMLCanvasElement; W: number; H: number } | null = null;
  private readonly strips = new Map<BackdropLayer, Strip>();

  constructor(
    private readonly theme: Theme,
    private readonly refY: number,
    private readonly xMin = -50,
    private readonly xMax = 1000,
  ) {
    this.cloudColor = mix(theme.skyBottom, '#ffffff', 0.45);
    this.clouds = Array.from({ length: 9 }, (_, i) => ({
      x: hash1(i * 3.3 + 1) * 3,
      y: 0.08 + hash1(i * 5.1 + 2) * 0.3,
      w: 0.12 + hash1(i * 7.7 + 3) * 0.2,
      seed: i,
    }));
    this.stars = Array.from({ length: 140 }, (_, i) => ({
      x: hash1(i * 1.37 + 9),
      y: Math.pow(hash1(i * 2.71 + 4), 1.6) * 0.62,
      r: 0.4 + hash1(i * 4.13) * 1.3,
      tw: hash1(i * 8.9) * 6.28,
    }));
  }

  draw(ctx: CanvasRenderingContext2D, v: View, time: number): void {
    const { W, H } = v;
    const th = this.theme;
    if (!this.sky || this.sky.W !== W || this.sky.H !== H) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(W / 4));
      c.height = Math.max(1, Math.round(H / 2));
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      const sky = g.createLinearGradient(0, 0, 0, c.height);
      sky.addColorStop(0, th.skyTop);
      sky.addColorStop(0.55, th.skyMid);
      sky.addColorStop(1, th.skyBottom);
      g.fillStyle = sky;
      g.fillRect(0, 0, c.width, c.height);
      this.sky = { canvas: c, W, H };
    }
    ctx.drawImage(this.sky.canvas, 0, 0, W, H);

    if (th.stars) {
      for (const s of this.stars) {
        const a = 0.45 + 0.55 * Math.sin(time * 1.7 + s.tw) ** 2;
        ctx.fillStyle = `rgba(230,240,255,${a.toFixed(2)})`;
        const x = ((s.x * W - v.cx * 0.6) % W + W) % W;
        ctx.fillRect(x, s.y * H, s.r, s.r);
      }
    }

    if (th.sun) {
      const sx = th.sun.x * W;
      const sy = th.sun.y * H + clamp((v.cy - this.refY) * 0.8, -H * 0.15, H * 0.15);
      const r = th.sun.r * H;
      const g = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 7);
      g.addColorStop(0, th.sun.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r * 7, sy - r * 7, r * 14, r * 14);
      ctx.fillStyle = th.sun.color;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!th.night) this.drawClouds(ctx, v, time);

    for (const layer of th.layers) this.drawLayer(ctx, v, layer, time);
  }

  private drawClouds(ctx: CanvasRenderingContext2D, v: View, time: number): void {
    const { W, H } = v;
    ctx.save();
    for (const c of this.clouds) {
      const span = W * 1.6;
      const x = ((((c.x * span - v.cx * 3 - time * 6 * (0.5 + c.w)) % span) + span) % span) - W * 0.3;
      const y = c.y * H;
      const w = c.w * W;
      ctx.globalAlpha = 0.1 + c.w * 0.35;
      ctx.fillStyle = this.cloudColor;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.5, w * 0.035, 0, 0, Math.PI * 2);
      for (let k = 0; k < 4; k++) {
        const ox = (k / 3 - 0.5) * w * 0.6;
        const r = w * (0.09 + 0.05 * Math.sin(k * 1.9 + c.seed));
        ctx.moveTo(x + ox + r, y - r * 0.15);
        ctx.ellipse(x + ox, y - r * 0.15, r, r * 0.38, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLayer(ctx: CanvasRenderingContext2D, v: View, layer: BackdropLayer, time: number): void {
    const { W, H } = v;
    const baseY = H * (layer.base - 0.1) + clamp((v.cy - this.refY) * layer.parallax * 0.9, -2.2, 2.2) * (H / 16);
    const amp = H * layer.height * 1.25;
    if (layer.kind === 'city' || layer.kind === 'stadium') {
      this.drawStrip(ctx, v, layer, baseY, amp, time);
      return;
    }
    const step = 4;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let px = -step; px <= W + step; px += step) {
      const t = (px - W / 2) / H + (v.cx * layer.parallax) / 16;
      xs.push(px);
      ys.push(baseY - profile(layer.kind, t, layer.seed) * amp);
    }
    ctx.beginPath();
    ctx.moveTo(xs[0], H + 2);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.lineTo(xs[xs.length - 1], H + 2);
    ctx.closePath();
    ctx.fillStyle = layer.color;
    ctx.fill();

    // Luz de borde en las crestas.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = layer.rim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xs[i], ys[i] + 0.8);
    ctx.stroke();
    ctx.restore();

    // Bruma: cada plano se funde con el aire en su base.
    const top = baseY - amp;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, `rgba(${this.theme.haze},0)`);
    g.addColorStop(0.7, `rgba(${this.theme.haze},0.16)`);
    g.addColorStop(1, `rgba(${this.theme.haze},0.32)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
  }

  /**
   * Ciudad y estadio tienen miles de ventanas y espectadores: se dibujan una
   * sola vez en una tira que cubre todo el recorrido y luego se copia el trozo
   * visible cada frame.
   */
  private drawStrip(ctx: CanvasRenderingContext2D, v: View, layer: BackdropLayer, baseY: number, amp: number, time: number): void {
    const { W, H } = v;
    let strip = this.strips.get(layer);
    if (!strip || strip.W !== W || strip.H !== H) {
      const tMin = -W / 2 / H + ((this.xMin - 40) * layer.parallax) / 16;
      const tMax = W / 2 / H + ((this.xMax + 80) * layer.parallax) / 16;
      const widthCss = (tMax - tMin) * H;
      const heightCss = amp + 40;
      const scale = Math.min(1, 16000 / widthCss);
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(widthCss * scale);
      canvas.height = Math.ceil(heightCss * scale);
      const g = canvas.getContext('2d') as CanvasRenderingContext2D;
      g.scale(scale, scale);
      // Vista ficticia: el "centro" de la tira coincide con tMin.
      const fake: View = { ...v, W: widthCss, cx: 0 };
      const localBase = heightCss;
      g.beginPath();
      g.moveTo(0, heightCss + 2);
      for (let px = 0; px <= widthCss + 4; px += 4) {
        const t = tMin + px / H;
        g.lineTo(px, localBase - profile(layer.kind, t, layer.seed) * amp);
      }
      g.lineTo(widthCss + 4, heightCss + 2);
      g.closePath();
      g.fillStyle = layer.color;
      g.fill();
      g.globalAlpha = 0.55;
      g.strokeStyle = layer.rim;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let px = 0; px <= widthCss + 4; px += 4) {
        const t = tMin + px / H;
        const y = localBase - profile(layer.kind, t, layer.seed) * amp + 0.8;
        if (px === 0) g.moveTo(px, y);
        else g.lineTo(px, y);
      }
      g.stroke();
      g.globalAlpha = 1;
      // Reutiliza los dibujantes con una vista desplazada a tMin.
      const shiftCx = ((tMin + widthCss / 2 / H) * 16) / layer.parallax;
      const view: View = { ...fake, cx: shiftCx };
      if (layer.kind === 'city') this.cityWindows(g, view, layer, localBase, amp, 0);
      else this.stadiumLights(g, view, layer, localBase, amp, 0);
      strip = { canvas, W, H, tMin, scale, heightCss };
      this.strips.set(layer, strip);
    }
    const tLeft = -W / 2 / H + (v.cx * layer.parallax) / 16;
    const sx = (tLeft - strip.tMin) * H * strip.scale;
    const top = baseY - strip.heightCss;
    ctx.drawImage(strip.canvas, sx, 0, W * strip.scale, strip.canvas.height, 0, top, W, strip.heightCss);
    if (baseY < H) {
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, baseY - 1, W, H - baseY + 1);
    }
    if (layer.kind === 'stadium') {
      // Flashes de camaras en la grada, en vivo.
      for (let i = 0; i < 6; i++) {
        const k = Math.floor(time * 3 + i * 7.3);
        if (hash1(k * 1.3 + i) > 0.55) continue;
        const x = hash1(k * 2.1 + i) * W;
        const y = baseY - amp * (0.3 + hash1(k * 3.7) * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x, y, 2.5, 2.5);
      }
    }
    const g = ctx.createLinearGradient(0, baseY - amp, 0, H);
    g.addColorStop(0, `rgba(${this.theme.haze},0)`);
    g.addColorStop(0.7, `rgba(${this.theme.haze},0.16)`);
    g.addColorStop(1, `rgba(${this.theme.haze},0.32)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, baseY - amp, W, H - baseY + amp);
  }

  private cityWindows(ctx: CanvasRenderingContext2D, v: View, layer: BackdropLayer, baseY: number, amp: number, time: number): void {
    const { W, H } = v;
    const w = 0.045;
    const offset = (v.cx * layer.parallax) / 16;
    const t0 = -W / 2 / H + offset;
    const t1 = W / 2 / H + offset;
    const s = layer.seed * 37.1;
    for (let cell = Math.floor(t0 / w + s) - 1; cell <= Math.ceil(t1 / w + s) + 1; cell++) {
      const h = profile('city', (cell + 0.5 - s) * w, layer.seed);
      const x0 = ((cell - s) * w - offset) * H + W / 2;
      const bw = w * H;
      const top = baseY - h * amp;
      for (let yy = top + 6; yy < baseY - 4; yy += 7) {
        for (let xx = x0 + bw * 0.14; xx < x0 + bw * 0.9; xx += 6) {
          const r = hash1(cell * 13.1 + yy * 0.37 + xx * 0.11);
          if (r > 0.62) {
            const flick = r > 0.985 ? 0.5 + 0.5 * Math.sin(time * 3 + r * 40) : 1;
            ctx.fillStyle = `rgba(255,${200 + Math.round(r * 40)},140,${(0.35 + r * 0.35) * flick})`;
            ctx.fillRect(xx, yy, 2.4, 3);
          }
        }
      }
    }
  }

  private stadiumLights(ctx: CanvasRenderingContext2D, v: View, layer: BackdropLayer, baseY: number, amp: number, time: number): void {
    const { W, H } = v;
    const period = 2.2;
    const offset = (v.cx * layer.parallax) / 16;
    const s = layer.seed * 37.1;
    const t0 = -W / 2 / H + offset;
    const k0 = Math.floor(t0 / period + s) - 1;
    for (let k = k0; k < k0 + 4; k++) {
      // Grada: filas de publico (puntos que brillan con flashes).
      const gx0 = ((k - s + 0.12) * period - offset) * H + W / 2;
      const gx1 = ((k - s + 0.82) * period - offset) * H + W / 2;
      for (let row = 0; row < 9; row++) {
        const fy = 0.15 + row * 0.055;
        for (let x = gx0; x < gx1; x += 5) {
          const f = (x - gx0) / (gx1 - gx0);
          const topH = (0.62 + f * 0.3) * amp;
          const y = baseY - topH + fy * amp + 6;
          if (y > baseY - 4) continue;
          const r = hash1(x * 0.37 + row * 17.3 + k * 3.1);
          const flash = r > 0.992 && Math.sin(time * 9 + r * 100) > 0.7;
          ctx.fillStyle = flash ? 'rgba(255,255,255,0.95)' : `hsla(${Math.round(r * 360)},55%,${35 + r * 20}%,0.55)`;
          ctx.fillRect(x, y + Math.sin(time * 6 + r * 30) * 0.8, 2.2, 2.2);
        }
      }
      // Torres de focos en el techo.
      const lx = ((k - s + 0.84) * period - offset) * H + W / 2;
      const ly = baseY - 0.98 * amp - 26;
      ctx.fillStyle = '#0b0f1d';
      ctx.fillRect(lx - 1.5, ly, 3, 30);
      ctx.fillStyle = '#e8f1ff';
      ctx.fillRect(lx - 9, ly - 6, 18, 7);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, ly - 3, 2, lx, ly - 3, 90);
      g.addColorStop(0, 'rgba(200,225,255,0.55)');
      g.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - 90, ly - 93, 180, 180);
      ctx.restore();
    }
  }
}
