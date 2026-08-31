/**
 * ParticleSystem.ts
 *
 * Sistema de particulas minimo: un pool fijo de polvo que se reutiliza (sin
 * asignaciones por frame). Se dispara desde el contacto de ruedas y desde
 * aterrizajes/crashes.
 */

import { EffectsConfig } from '../config/GameConfig';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  alive: boolean;
  size: number;
}

export class ParticleSystem {
  private readonly pool: Particle[];
  private cursor = 0;

  constructor(private readonly maxParticles = EffectsConfig.dust.maxParticles) {
    this.pool = Array.from({ length: maxParticles }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      alive: false,
      size: 1,
    }));
  }

  private spawnOne(x: number, y: number, vx: number, vy: number, size: number): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.maxParticles;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = EffectsConfig.dust.life;
    p.maxLife = EffectsConfig.dust.life;
    p.alive = true;
    p.size = size;
  }

  spawnDust(x: number, y: number, speed: number): void {
    if (speed < EffectsConfig.dust.minSpeedToSpawn) return;
    const count = Math.max(1, Math.round(EffectsConfig.dust.spawnPerContactTick));
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + (Math.random() - 0.5) * 1.4;
      const speedFactor = Math.min(1, speed / 20);
      const vx = Math.cos(angle) * speedFactor * 2 - speed * 0.05;
      const vy = Math.abs(Math.sin(angle)) * speedFactor * 2;
      this.spawnOne(x, y, vx, vy, 0.08 + Math.random() * 0.1);
    }
  }

  /**
   * Tierra levantada por el DESLIZAMIENTO real del neumatico, no por la
   * velocidad del chasis. Es la diferencia que se ve: patinar parado echa
   * tierra, y rodar limpio a 30 m/s no echa ninguna.
   *
   * `slip` es la velocidad de deslizamiento en m/s (positiva = la rueda gira
   * mas rapido que el suelo, acelerando; negativa = bloqueada, frenando).
   * `carry` es el resto fraccionario de particulas del tick anterior, para
   * que un caudal de, por ejemplo, 0.4 particulas por tick no se redondee a
   * cero y no salga nunca nada.
   */
  spawnSlipDust(x: number, y: number, slip: number, dt: number, carry: number): number {
    const magnitude = Math.abs(slip);
    const { minSlipToSpawn, fullSlip, maxParticlesPerSecond } = EffectsConfig.slip;
    if (!Number.isFinite(magnitude) || magnitude < minSlipToSpawn) return 0;

    const intensity = Math.min(1, (magnitude - minSlipToSpawn) / Math.max(0.001, fullSlip - minSlipToSpawn));
    const wanted = carry + intensity * maxParticlesPerSecond * dt;
    const count = Math.floor(wanted);

    // La tierra sale disparada en contra del deslizamiento: si la rueda patina
    // hacia adelante, el chorro va hacia atras, y al reves al bloquearse.
    const direction = -Math.sign(slip);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.1;
      const speed = 1.4 + intensity * 5.5 * Math.random();
      this.spawnOne(
        x,
        y,
        direction * speed * (0.7 + Math.random() * 0.6),
        Math.abs(Math.sin(Math.PI * 0.5 + spread)) * speed * 0.75,
        0.07 + Math.random() * 0.11 * (0.5 + intensity),
      );
    }
    return wanted - count;
  }

  spawnBurst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI;
      const speed = 1.5 + Math.random() * 2.5;
      this.spawnOne(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.1 + Math.random() * 0.12);
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy -= EffectsConfig.dust.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  forEachAlive(fn: (x: number, y: number, alpha: number, size: number) => void): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      fn(p.x, p.y, p.life / p.maxLife, p.size);
    }
  }
}
