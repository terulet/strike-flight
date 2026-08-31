/**
 * ParticleSystem.ts
 *
 * Sistema de particulas minimo: un pool fijo de polvo que se reutiliza (sin
 * asignaciones por frame). Se dispara desde el contacto de ruedas y desde
 * aterrizajes/crashes.
 */

import { EffectsConfig } from '../config/GameConfig';

/**
 * Tipo de particula. No es cosmetico: cada uno se comporta y se pinta
 * distinto, que es lo que permite distinguir de un vistazo que esta pasando.
 *
 *  - `dirt`   terrones que arranca el neumatico. Pesados, vuelan y caen.
 *  - `dust`   polvo fino en suspension. Ligero, se expande y se desvanece.
 *  - `brake`  polvo de frenada. Sale hacia adelante y muy bajo, pegado al suelo.
 *  - `impact` el golpe de un aterrizaje. Rapido, radial y de vida corta.
 */
export type ParticleKind = 'dirt' | 'dust' | 'brake' | 'impact';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  alive: boolean;
  size: number;
  kind: ParticleKind;
  /** Crecimiento del radio por segundo. El polvo se expande, los terrones no. */
  growth: number;
  /** Rozamiento con el aire por segundo. */
  drag: number;
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
      kind: 'dust' as ParticleKind,
      growth: 0,
      drag: 0,
    }));
  }

  private spawnOne(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    kind: ParticleKind = 'dust',
    life: number = EffectsConfig.dust.life,
  ): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.maxParticles;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.alive = true;
    p.size = size;
    p.kind = kind;
    // El polvo se expande y frena mucho; los terrones ni una cosa ni la otra.
    p.growth = kind === 'dust' || kind === 'brake' ? 0.32 : kind === 'impact' ? 0.5 : 0.02;
    p.drag = kind === 'dirt' ? 0.6 : kind === 'impact' ? 3.4 : 2.6;
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
        0.05 + Math.random() * 0.08 * (0.5 + intensity),
        // Patinar arranca TERRONES, no polvo: pesan, vuelan y caen.
        Math.random() < 0.65 ? 'dirt' : 'dust',
        0.45 + Math.random() * 0.4,
      );
    }
    return wanted - count;
  }

  /**
   * Polvo continuo de rodadura. Depende del contacto y del ESFUERZO que pasa
   * por el neumatico, no solo de la velocidad: rodar lanzado por una recta
   * levanta poco, y salir de parado a fondo levanta mucho aunque la moto casi
   * no se mueva todavia.
   */
  spawnRollingDust(x: number, y: number, speed: number, effort: number, dt: number, carry: number): number {
    const { minSpeedToSpawn } = EffectsConfig.dust;
    const intensity = Math.min(1, Math.max(0, effort)) * Math.min(1, Math.abs(speed) / 12);
    if (Math.abs(speed) < minSpeedToSpawn * 0.4 && effort < 0.25) return 0;

    const wanted = carry + intensity * EffectsConfig.slip.maxParticlesPerSecond * 0.5 * dt;
    const count = Math.floor(wanted);
    for (let i = 0; i < count; i++) {
      const back = -Math.sign(speed || 1);
      this.spawnOne(
        x,
        y + 0.02,
        back * (0.6 + Math.random() * 1.8) - speed * 0.04,
        0.4 + Math.random() * 1.5,
        0.06 + Math.random() * 0.09,
        'dust',
        0.5 + Math.random() * 0.35,
      );
    }
    return wanted - count;
  }

  /** Polvo de frenada: sale hacia adelante y muy pegado al suelo. */
  spawnBrakeDust(x: number, y: number, speed: number, dt: number, carry: number): number {
    const intensity = Math.min(1, Math.abs(speed) / 14);
    const wanted = carry + intensity * 55 * dt;
    const count = Math.floor(wanted);
    const forward = Math.sign(speed || 1);
    for (let i = 0; i < count; i++) {
      this.spawnOne(
        x,
        y + 0.01,
        forward * (1.2 + Math.random() * 2.6),
        0.15 + Math.random() * 0.5,
        0.05 + Math.random() * 0.07,
        'brake',
        0.4 + Math.random() * 0.3,
      );
    }
    return wanted - count;
  }

  /**
   * Golpe de aterrizaje: un anillo de polvo que sale hacia los lados desde el
   * punto de contacto, mas unos terrones. Es el "golpe visual" del mandato.
   */
  spawnLandingImpact(x: number, y: number, strength: number): void {
    const dustCount = Math.round(8 + strength * 16);
    for (let i = 0; i < dustCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const spread = 0.25 + Math.random() * 0.9;
      this.spawnOne(
        x + side * Math.random() * 0.3,
        y + 0.02,
        side * (1.5 + Math.random() * 4.5) * (0.5 + strength),
        spread * (0.6 + strength),
        0.07 + Math.random() * 0.11,
        'impact',
        0.35 + Math.random() * 0.4,
      );
    }
    const clodCount = Math.round(3 + strength * 8);
    for (let i = 0; i < clodCount; i++) {
      const angle = Math.PI * (0.15 + Math.random() * 0.7);
      const speed = (2 + Math.random() * 4) * (0.6 + strength);
      this.spawnOne(
        x,
        y + 0.05,
        Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
        Math.sin(angle) * speed,
        0.04 + Math.random() * 0.06,
        'dirt',
        0.5 + Math.random() * 0.4,
      );
    }
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
      // Los terrones caen; el polvo casi flota y se lo lleva el aire.
      const gravity = p.kind === 'dirt' ? EffectsConfig.dust.gravity : EffectsConfig.dust.gravity * 0.22;
      p.vy -= gravity * dt;
      const dragFactor = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.growth * dt;
    }
  }

  forEachAlive(fn: (x: number, y: number, alpha: number, size: number, kind: ParticleKind) => void): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      fn(p.x, p.y, p.life / p.maxLife, p.size, p.kind);
    }
  }
}
