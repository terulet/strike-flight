/**
 * EFFECTS — partículas y polvo ambiental.
 *
 * Dos poblaciones con reglas distintas a propósito:
 *
 *   partículas  chispas, casquillos, restos. Emiten luz propia → capa
 *               emisiva, visibles siempre. Son información.
 *   polvo       mota en suspensión. NO emite: solo se ve cuando algo la
 *               ilumina → capa dinámica. Es lo que da volumen al haz de
 *               un disparo y hace que la luz parezca atravesar aire.
 *
 * Todo sale de un pool de tamaño fijo. Un fogonazo nunca debe provocar una
 * pausa del recolector de basura justo en el fotograma que más importa.
 */

import { Config } from '../config/Config.js';
import { Pool } from '../core/Pool.js';
import { rng } from '../core/Rng.js';
import { TAU, rgba } from '../core/MathUtils.js';

const makeParticle = () => ({
  x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
  size: 2, drag: 4, tint: [1, 1, 1], glow: 1, kind: 'spark',
});

export class Effects {
  constructor(level) {
    this.level = level;
    this.particles = new Pool(makeParticle, Config.fx.maxParticles);
    this.dust = [];
    this.#seedDust();
  }

  reset() {
    this.particles.clear();
    this.#seedDust();
  }

  #seedDust() {
    this.dust.length = 0;
    for (let i = 0; i < Config.fx.dustCount; i++) {
      this.dust.push({
        x: rng.range(0, this.level.width),
        y: rng.range(0, this.level.height),
        vx: rng.spread(Config.fx.dustDrift),
        vy: rng.spread(Config.fx.dustDrift),
        size: rng.range(0.6, 1.8),
        a: rng.range(0.25, 0.75),
      });
    }
  }

  #emit(x, y, angle, speed, life, size, tint, glow = 1, kind = 'spark', drag = 4.5) {
    const p = this.particles.obtain();
    if (!p) return null;   // pool lleno: se descarta, nunca se crece
    p.x = x; p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = p.maxLife = life;
    p.size = size; p.tint = tint; p.glow = glow; p.kind = kind; p.drag = drag;
    return p;
  }

  muzzle(x, y, angle) {
    const t = Config.lighting.muzzle.tint;
    for (let i = 0; i < Config.fx.muzzleParticles; i++) {
      this.#emit(
        x, y,
        angle + rng.spread(0.42),
        rng.range(190, 520),
        rng.range(0.06, 0.16),
        rng.range(1.4, 3.0),
        t, 1.6,
      );
    }
    // Humo: lento, oscuro, sin brillo. Se queda flotando en el aire.
    for (let i = 0; i < 3; i++) {
      this.#emit(x, y, angle + rng.spread(0.7), rng.range(30, 80), rng.range(0.4, 0.8),
        rng.range(3, 7), [0.42, 0.48, 0.6], 0.18, 'smoke', 2.2);
    }
  }

  impact(x, y, nx, ny) {
    const t = Config.lighting.impact.tint;
    const base = Math.atan2(ny, nx);
    for (let i = 0; i < Config.fx.impactParticles; i++) {
      this.#emit(
        x, y,
        base + rng.spread(1.15),
        rng.range(120, 420),
        rng.range(0.09, 0.28),
        rng.range(1.0, 2.4),
        t, 1.5,
      );
    }
  }

  shell(x, y, angle) {
    if (!rng.chance(Config.fx.shellChance)) return;
    // Sale hacia el lado, no hacia atrás: se lee como eyección, no como resto.
    this.#emit(x, y, angle + Math.PI / 2 + rng.spread(0.4), rng.range(90, 170),
      rng.range(0.5, 0.85), 1.5, [1.0, 0.82, 0.45], 0.9, 'shell', 3.0);
  }

  death(x, y, tint) {
    for (let i = 0; i < Config.fx.deathParticles; i++) {
      this.#emit(x, y, rng.range(0, TAU), rng.range(60, 380), rng.range(0.25, 0.7),
        rng.range(1.2, 3.4), tint, 1.3);
    }
  }

  bloodMist(x, y, angle) {
    for (let i = 0; i < 5; i++) {
      this.#emit(x, y, angle + rng.spread(0.8), rng.range(50, 200), rng.range(0.2, 0.45),
        rng.range(1.5, 3), [1.0, 0.25, 0.3], 0.8);
    }
  }

  update(dt) {
    this.particles.forEach((p, i) => {
      p.life -= dt;
      if (p.life <= 0) { this.particles.release(i); return; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      // Las chispas rebotan en la geometría; el humo la atraviesa.
      if (p.kind !== 'smoke' && this.level.isSolidAt(nx, ny)) {
        if (this.level.isSolidAt(nx, p.y)) p.vx *= -0.42;
        if (this.level.isSolidAt(p.x, ny)) p.vy *= -0.42;
      } else {
        p.x = nx; p.y = ny;
      }
    });

    const W = this.level.width, H = this.level.height;
    for (const d of this.dust) {
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.x < 0) d.x += W; else if (d.x > W) d.x -= W;
      if (d.y < 0) d.y += H; else if (d.y > H) d.y -= H;
    }
  }

  /** Capa emisiva: brilla por sí misma, la oscuridad no la tapa. */
  renderEmissive(ctx, cam) {
    this.particles.forEach((p) => {
      if (p.glow <= 0.2) return;
      const k = p.life / p.maxLife;
      const a = k * k * p.glow;
      ctx.fillStyle = rgba(p.tint, Math.min(1, a));
      const s = p.size * (0.45 + k * 0.55);
      ctx.fillRect(p.x - cam.x - s / 2, p.y - cam.y - s / 2, s, s);
    });
  }

  /** Capa dinámica: humo y polvo, visibles solo si hay luz encima. */
  renderLit(ctx, cam) {
    this.particles.forEach((p) => {
      if (p.glow > 0.2) return;
      const k = p.life / p.maxLife;
      ctx.fillStyle = rgba(p.tint, k * 0.5);
      const s = p.size * (1.4 - k * 0.4);
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, s, 0, TAU);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(190,215,255,0.5)';
    for (const d of this.dust) {
      const sx = d.x - cam.x, sy = d.y - cam.y;
      if (sx < -4 || sy < -4 || sx > cam.viewW + 4 || sy > cam.viewH + 4) continue;
      ctx.globalAlpha = d.a;
      ctx.fillRect(sx, sy, d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }
}
