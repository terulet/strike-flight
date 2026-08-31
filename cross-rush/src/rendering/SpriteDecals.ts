/**
 * SpriteDecals.ts
 *
 * Sellos de imagen de un solo uso (no un emisor continuo como ParticleSystem):
 * el puñado de polvo de un aterrizaje o un derrape puntual. Se dispara una
 * vez, se dibuja encogiendose/desvaneciendose un rato corto y desaparece.
 * Pool fijo, sin asignaciones por frame.
 */

const MAX_DECALS = 6;
const LIFE_SECONDS = 0.55;

interface Decal {
  x: number;
  y: number;
  image: HTMLImageElement;
  life: number;
  alive: boolean;
}

export class SpriteDecals {
  private readonly pool: Decal[] = Array.from({ length: MAX_DECALS }, () => ({
    x: 0,
    y: 0,
    image: new Image(),
    life: 0,
    alive: false,
  }));
  private cursor = 0;

  spawn(x: number, y: number, image: HTMLImageElement): void {
    const d = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_DECALS;
    d.x = x;
    d.y = y;
    d.image = image;
    d.life = LIFE_SECONDS;
    d.alive = true;
  }

  update(dt: number): void {
    for (const d of this.pool) {
      if (!d.alive) continue;
      d.life -= dt;
      if (d.life <= 0) d.alive = false;
    }
  }

  forEachAlive(fn: (x: number, y: number, alpha: number, image: HTMLImageElement) => void): void {
    for (const d of this.pool) {
      if (!d.alive) continue;
      fn(d.x, d.y, Math.max(0, d.life / LIFE_SECONDS), d.image);
    }
  }
}
