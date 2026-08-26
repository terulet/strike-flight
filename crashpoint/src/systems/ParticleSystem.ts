import type { MaterialId } from '../core/types';
import { getMaterial } from '../physics/materials';

export type ParticleKind = 'dust' | 'spark' | 'debris' | 'smoke';

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: ParticleKind;
  rotation: number;
  vr: number;
}

const POOL_SIZE = 420; // hard cap keeps this cheap even during a mega collapse (section 36)

/** Lightweight pooled particle system — visual-only debris/dust/sparks, never real physics bodies. */
export class ParticleSystem {
  private pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, color: '#fff', kind: 'dust', rotation: 0, vr: 0 });
    }
  }

  private spawnOne(x: number, y: number, kind: ParticleKind, color: string, speed: number, size: number, life: number): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    const angle = Math.random() * Math.PI * 2;
    const upBias = kind === 'smoke' ? -0.6 : -0.15;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed * (0.4 + Math.random() * 0.6);
    p.vy = Math.sin(angle) * speed * (0.4 + Math.random() * 0.6) + speed * upBias;
    p.life = life;
    p.maxLife = life;
    p.size = size * (0.6 + Math.random() * 0.8);
    p.color = color;
    p.kind = kind;
    p.rotation = Math.random() * Math.PI * 2;
    p.vr = (Math.random() - 0.5) * 6;
  }

  burstImpact(x: number, y: number, material: MaterialId): void {
    const mat = getMaterial(material);
    for (let i = 0; i < 6; i++) this.spawnOne(x, y, 'dust', '#cfcfcf', 60, 5, 0.35);
    if (material === 'metal') for (let i = 0; i < 5; i++) this.spawnOne(x, y, 'spark', '#ffd873', 140, 3, 0.25);
    else for (let i = 0; i < 3; i++) this.spawnOne(x, y, 'debris', mat.color, 90, 4, 0.4);
  }

  burstBreak(x: number, y: number, material: MaterialId): void {
    const mat = getMaterial(material);
    const count = material === 'glass' ? 18 : 12;
    for (let i = 0; i < count; i++) this.spawnOne(x, y, material === 'glass' ? 'spark' : 'debris', mat.color, 130, material === 'glass' ? 3 : 6, 0.7);
    for (let i = 0; i < 10; i++) this.spawnOne(x, y, 'dust', '#d8d8d8', 70, 7, 0.9);
  }

  burstExplosion(x: number, y: number): void {
    for (let i = 0; i < 26; i++) this.spawnOne(x, y, 'spark', '#ffb84d', 220, 4, 0.5);
    for (let i = 0; i < 20; i++) this.spawnOne(x, y, 'smoke', '#4b4b4b', 60, 20, 1.6);
    for (let i = 0; i < 16; i++) this.spawnOne(x, y, 'dust', '#e0e0e0', 150, 9, 0.8);
  }

  burstMegaCollapse(x: number, y: number): void {
    for (let i = 0; i < 40; i++) this.spawnOne(x, y, 'dust', '#c9c4bb', 100, 14, 2.2);
    for (let i = 0; i < 14; i++) this.spawnOne(x, y, 'smoke', '#5a5a5a', 40, 26, 2.6);
  }

  update(dtSec: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dtSec;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += (p.kind === 'smoke' ? -40 : 220) * dtSec; // smoke floats, everything else falls
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.rotation += p.vr * dtSec;
      p.vx *= 0.98;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') {
        ctx.fillRect(-p.size / 2, -1, p.size, 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }
}
