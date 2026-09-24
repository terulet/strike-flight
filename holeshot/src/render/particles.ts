/**
 * Particulas del mundo (metros): tierra que escupe la rueda, nubes de polvo,
 * chispas, llama del nitro. Y particulas de pantalla para el clima.
 */
import { hash1 } from '../core/math';
import { Weather } from '../game/missions';
import { Terrain } from '../physics/terrain';
import { View } from './view';

type Kind = 'clod' | 'dust' | 'flame' | 'spark';

interface P {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

const MAX = 900;

export class Particles {
  private readonly list: P[] = [];

  clear(): void {
    this.list.length = 0;
  }

  emit(kind: Kind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ kind, x, y, vx, vy, life, max: life, size, color, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
  }

  update(dt: number, terrain: Terrain): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      if (p.kind === 'clod' || p.kind === 'spark') {
        p.vy -= 11.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const g = terrain.heightAt(p.x);
        if (p.y < g) {
          p.y = g;
          p.vy *= -0.25;
          p.vx *= 0.5;
          p.vr *= 0.5;
          if (p.kind === 'spark') p.life = Math.min(p.life, 0.05);
        }
      } else if (p.kind === 'dust') {
        p.vx *= 1 - dt * 1.8;
        p.vy = p.vy * (1 - dt * 1.5) + dt * 0.35;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += dt * 0.9;
      } else {
        p.vx *= 1 - dt * 3;
        p.vy = p.vy * (1 - dt * 3) + dt * 2;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, v: View, layer: 'back' | 'front'): void {
    for (const p of this.list) {
      if (p.x < v.x0 - 2 || p.x > v.x1 + 2) continue;
      const t = p.life / p.max;
      if (layer === 'back' && p.kind === 'dust') {
        ctx.globalAlpha = Math.min(1, t * 1.6) * 0.22;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (layer === 'front' && p.kind === 'clod') {
        ctx.globalAlpha = Math.min(1, t * 3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.7, p.size * 2, p.size * 1.4);
        ctx.restore();
      } else if (layer === 'front' && (p.kind === 'flame' || p.kind === 'spark')) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'flame' ? 0.5 + t : 1), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
  }
}

let fogCanvas: HTMLCanvasElement | null = null;
function fogSprite(): HTMLCanvasElement {
  if (fogCanvas) return fogCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(225,240,232,1)');
  grad.addColorStop(1, 'rgba(225,240,232,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  fogCanvas = c;
  return c;
}

interface WP {
  x: number;
  y: number;
  z: number;
  seed: number;
}

/** Clima en espacio de pantalla (0..1), con paralaje segun la camara. */
export class WeatherFx {
  private readonly ps: WP[];
  private lastCx = 0;
  private lastCy = 0;

  constructor(private readonly kind: Weather) {
    const n = kind === 'fog' ? 6 : kind === 'sand' ? 120 : kind === 'confetti' ? 90 : 70;
    this.ps = Array.from({ length: n }, (_, i) => ({ x: hash1(i * 3.1), y: hash1(i * 7.3), z: 0.3 + hash1(i * 1.9) * 0.7, seed: i }));
  }

  draw(ctx: CanvasRenderingContext2D, v: View, dt: number, time: number): void {
    const { W, H } = v;
    const dcx = ((v.cx - this.lastCx) * v.ppm) / W;
    const dcy = ((v.cy - this.lastCy) * v.ppm) / H;
    this.lastCx = v.cx;
    this.lastCy = v.cy;
    const jump = Math.abs(dcx) > 0.5 || Math.abs(dcy) > 0.5;
    for (const p of this.ps) {
      if (!jump) {
        p.x -= dcx * p.z * 1.2;
        p.y += dcy * p.z * 1.2;
      }
      switch (this.kind) {
        case 'dust':
          p.x += dt * 0.012 * p.z;
          p.y += Math.sin(time * 0.7 + p.seed) * dt * 0.01;
          break;
        case 'sand':
          p.x += dt * (0.9 + p.z) * 0.9;
          p.y += dt * 0.05;
          break;
        case 'fog':
          p.x += dt * 0.01 * p.z;
          break;
        case 'confetti':
          p.y += dt * (0.06 + p.z * 0.08);
          p.x += Math.sin(time * 2 + p.seed) * dt * 0.03;
          break;
        default:
          break;
      }
      p.x = ((p.x % 1.2) + 1.2) % 1.2;
      p.y = ((p.y % 1.1) + 1.1) % 1.1;
      const sx = (p.x - 0.1) * W;
      const sy = (p.y - 0.05) * H;
      if (this.kind === 'dust') {
        ctx.fillStyle = `rgba(255,235,200,${0.15 + p.z * 0.35})`;
        ctx.fillRect(sx, sy, 1.5 + p.z * 2, 1.5 + p.z * 2);
      } else if (this.kind === 'sand') {
        ctx.strokeStyle = `rgba(255,220,160,${0.12 + p.z * 0.3})`;
        ctx.lineWidth = 1 + p.z;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 20 - p.z * 40, sy - 3);
        ctx.stroke();
      } else if (this.kind === 'fog') {
        const r = (0.28 + p.z * 0.32) * H;
        ctx.globalAlpha = 0.2;
        ctx.drawImage(fogSprite(), sx - r, sy - r * 0.6, r * 2, r * 1.2);
        ctx.globalAlpha = 1;
      } else if (this.kind === 'confetti') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(time * (2 + p.z * 3) + p.seed);
        ctx.fillStyle = `hsla(${Math.round(hash1(p.seed) * 360)},85%,60%,${0.4 + p.z * 0.5})`;
        ctx.fillRect(-3, -1.5, 6 * Math.abs(Math.cos(time * 4 + p.seed)) + 1, 3);
        ctx.restore();
      }
    }
  }
}
