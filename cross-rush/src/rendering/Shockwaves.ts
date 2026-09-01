/**
 * Shockwaves.ts
 *
 * Anillos que se expanden desde un punto del suelo y se desvanecen. Se usan
 * en los golpes fuertes: aterrizajes duros, el impacto del mega salto y los
 * premios.
 *
 * Son geometria y no un sprite a proposito. Un PNG de onda tendria un tamano
 * fijo en metros y habria que estirarlo; un circulo dibujado crece con el
 * radio real del golpe y se ve igual de nitido a cualquier zoom, que es
 * justo lo que hace falta cuando la camara se abre en los saltos grandes.
 */

import { CameraPose } from './Camera';
import { Vec2 } from '../physics/MathUtils';

interface Ring {
  x: number;
  y: number;
  age: number;
  life: number;
  /** Radio final en metros. */
  reach: number;
  color: string;
  alive: boolean;
}

const MAX_RINGS = 12;

export class Shockwaves {
  private readonly rings: Ring[] = [];

  /** `strength` 0..1: un aterrizaje suave apenas levanta anillo. */
  spawn(x: number, y: number, strength: number, color = 'rgba(255, 226, 186, 1)'): void {
    const s = Math.max(0, Math.min(1, strength));
    if (s < 0.12) return;
    const ring = this.rings.find((r) => !r.alive) ?? (this.rings.length < MAX_RINGS ? ({} as Ring) : this.rings[0]);
    ring.x = x;
    ring.y = y;
    ring.age = 0;
    ring.life = 0.32 + s * 0.34;
    ring.reach = 1.1 + s * 3.6;
    ring.color = color;
    ring.alive = true;
    if (!this.rings.includes(ring)) this.rings.push(ring);
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.alive) continue;
      ring.age += dt;
      if (ring.age >= ring.life) ring.alive = false;
    }
  }

  reset(): void {
    for (const ring of this.rings) ring.alive = false;
  }

  /**
   * Dibuja los anillos vivos. `toScreen` es la misma proyeccion que usa el
   * resto del render, asi que el anillo sale exactamente donde golpeo la
   * rueda.
   */
  draw(ctx: CanvasRenderingContext2D, camera: CameraPose, toScreen: (x: number, y: number) => Vec2): void {
    ctx.save();
    for (const ring of this.rings) {
      if (!ring.alive) continue;
      const t = ring.age / ring.life;
      // Crece rapido y frena: es como se expande una onda de verdad.
      const radius = ring.reach * (1 - Math.pow(1 - t, 2.2));
      const alpha = Math.pow(1 - t, 1.6);
      const p = toScreen(ring.x, ring.y);
      const rx = radius * camera.pixelsPerMeter;
      // Aplastado contra el suelo: la onda se ve en perspectiva, no de frente.
      const ry = rx * 0.32;
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = Math.max(1, (0.09 - 0.05 * t) * camera.pixelsPerMeter);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
