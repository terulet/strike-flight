/**
 * Renderer.ts
 *
 * Dibuja el mundo (terreno, moto, particulas) en un canvas 2D usando la
 * camara para transformar coordenadas de mundo (metros, Y hacia arriba) a
 * coordenadas de pantalla (pixeles, Y hacia abajo).
 */

import { Terrain } from '../physics/Terrain';
import { BikeState } from '../physics/Bike';
import { Camera } from './Camera';
import { ParticleSystem } from './ParticleSystem';
import { BikeConfig } from '../config/GameConfig';

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');
    this.ctx = ctx;
  }

  resizeToDisplaySize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private worldToScreen(camera: Camera, wx: number, wy: number): { x: number; y: number } {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const ppm = camera.pixelsPerMeter * (window.devicePixelRatio ? 1 : 1);
    return {
      x: cx + (wx - camera.x) * ppm,
      y: cy - (wy - camera.y) * ppm,
    };
  }

  render(opts: {
    camera: Camera;
    terrain: Terrain;
    bike: BikeState;
    particles: ParticleSystem;
    flowValue: number;
    isRedline: boolean;
  }): void {
    const { ctx, canvas } = this;
    const { camera, terrain, bike, particles } = opts;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cielo con gradiente sutil.
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#1b2540');
    sky.addColorStop(1, '#0b0e14');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.drawTerrain(camera, terrain);
    this.drawParticles(camera, particles);
    this.drawBike(camera, bike, opts.isRedline);

    ctx.restore();
  }

  private drawTerrain(camera: Camera, terrain: Terrain): void {
    const { ctx, canvas } = this;
    const ppm = camera.pixelsPerMeter;
    const halfWidthMeters = canvas.width / 2 / ppm;
    const startX = Math.max(terrain.startX, camera.x - halfWidthMeters - 4);
    const endX = Math.min(terrain.endX, camera.x + halfWidthMeters + 4);
    const step = Math.max(0.15, 1 / ppm);

    ctx.beginPath();
    let first = true;
    for (let x = startX; x <= endX; x += step) {
      const y = terrain.surfaceY(x);
      const p = this.worldToScreen(camera, x, y);
      if (first) {
        ctx.moveTo(p.x, p.y);
        first = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    const bottomRight = this.worldToScreen(camera, endX, terrain.surfaceY(endX));
    const bottomLeft = this.worldToScreen(camera, startX, terrain.surfaceY(startX));
    ctx.lineTo(bottomRight.x, canvas.height);
    ctx.lineTo(bottomLeft.x, canvas.height);
    ctx.closePath();

    const fill = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height);
    fill.addColorStop(0, '#4a3521');
    fill.addColorStop(1, '#2a1c11');
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#9c7a4a';
    ctx.beginPath();
    first = true;
    for (let x = startX; x <= endX; x += step) {
      const y = terrain.surfaceY(x);
      const p = this.worldToScreen(camera, x, y);
      if (first) {
        ctx.moveTo(p.x, p.y);
        first = false;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  private drawParticles(camera: Camera, particles: ParticleSystem): void {
    const { ctx } = this;
    particles.forEachAlive((x, y, alpha, size) => {
      const p = this.worldToScreen(camera, x, y);
      ctx.globalAlpha = alpha * 0.65;
      ctx.fillStyle = '#c9b89a';
      const r = size * camera.pixelsPerMeter;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private drawBike(camera: Camera, bike: BikeState, isRedline: boolean): void {
    const { ctx } = this;
    const ppm = camera.pixelsPerMeter;
    const center = this.worldToScreen(camera, bike.x, bike.y);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(-bike.angle);

    // Cuerpo/chasis.
    const bodyLen = BikeConfig.wheelBase * ppm * 0.9;
    const bodyH = BikeConfig.comHeight * ppm * 0.7;
    ctx.fillStyle = isRedline ? '#ff5b3d' : '#ff8a3d';
    ctx.fillRect(-bodyLen / 2, -bodyH / 2 - bodyH * 0.3, bodyLen, bodyH);

    // Piloto (bloque simple sobre el chasis).
    ctx.fillStyle = '#233046';
    ctx.fillRect(-bodyLen * 0.12, -bodyH * 1.6, bodyLen * 0.35, bodyH * 1.2);

    ctx.restore();

    // Ruedas (en coordenadas de mundo reales, no giran con el chasis en el dibujo simplificado).
    const wheelR = BikeConfig.wheelRadius * ppm;
    const frontOffset = { x: BikeConfig.wheelBase / 2, y: -BikeConfig.comHeight };
    const rearOffset = { x: -BikeConfig.wheelBase / 2, y: -BikeConfig.comHeight };
    const cos = Math.cos(bike.angle);
    const sin = Math.sin(bike.angle);
    const rotate = (o: { x: number; y: number }) => ({
      x: o.x * cos - o.y * sin,
      y: o.x * sin + o.y * cos,
    });
    for (const [offset, contact] of [
      [rotate(frontOffset), bike.front.inContact] as const,
      [rotate(rearOffset), bike.rear.inContact] as const,
    ]) {
      const wp = this.worldToScreen(camera, bike.x + offset.x, bike.y + offset.y);
      ctx.beginPath();
      ctx.fillStyle = contact ? '#1b1f27' : '#3a4050';
      ctx.arc(wp.x, wp.y, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#666';
      ctx.stroke();
    }
  }
}
