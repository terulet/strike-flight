/**
 * Particles — fixed pool, zero allocation while playing.
 * Types: 'dust' (surface spray), 'spark' (impact), 'shard' (record burst), 'mote' (abyss).
 */
const MAX = 260;

export class Particles {
  constructor(max = MAX) {
    this.max = max;
    this.pool = new Array(max);
    for (let i = 0; i < max; i++) {
      this.pool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0, color: '#fff', gravity: 0, drag: 0, rot: 0, spin: 0, type: 'dust' };
    }
    this.cursor = 0;
    this.count = 0;
    this.enabled = true;
  }

  spawn(opts) {
    if (!this.enabled) return null;
    // Overwrite the oldest slot rather than growing: predictable memory, predictable cost.
    let p = null;
    for (let i = 0; i < this.max; i++) {
      const idx = (this.cursor + i) % this.max;
      if (!this.pool[idx].active) { p = this.pool[idx]; this.cursor = (idx + 1) % this.max; break; }
    }
    if (!p) { p = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % this.max; }
    p.active = true;
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.max = p.life = opts.life || 0.5;
    p.size = opts.size || 0.002;
    p.color = opts.color || '#ffffff';
    p.gravity = opts.gravity ?? 0.6;
    p.drag = opts.drag ?? 1.6;
    p.rot = opts.rot || 0; p.spin = opts.spin || 0;
    p.type = opts.type || 'dust';
    return p;
  }

  burst(n, factory) {
    for (let i = 0; i < n; i++) this.spawn(factory(i, n));
  }

  update(dt) {
    let count = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
      count++;
    }
    this.count = count;
  }

  clear() { for (const p of this.pool) p.active = false; this.count = 0; }
}
