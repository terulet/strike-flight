import Matter from 'matter-js';
import type { StructuralPiece } from '../entities/StructuralPiece';
import type { Projectile } from '../entities/Projectile';
import type { DecorSpec } from '../game/LevelSchema';
import type { CameraView } from '../systems/CameraSystem';
import type { Vec2 } from '../core/types';
import { getMaterial } from '../physics/materials';
import { drawPlaceholder } from '../assets/PlaceholderRenderer';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

const BASE_VIEW_WIDTH = 1050; // world units visible horizontally at zoom = 1 (docs/SCALE.md)

export interface RenderScene {
  camera: CameraView;
  worldWidth: number;
  worldHeight: number;
  groundY: number;
  decor: DecorSpec[];
  pieces: Map<string, StructuralPiece>;
  projectiles: Map<string, Projectile>;
  particles: ParticleSystem;
  trajectoryPreview: Vec2[] | null;
  launcherOrigin: Vec2;
  launcherAim: Vec2 | null;
  showColliders: boolean;
  physics: PhysicsWorld;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  dpr = Math.min(window.devicePixelRatio || 1, 2);

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  private pixelsPerUnit(zoom: number): number {
    return (this.canvas.width / BASE_VIEW_WIDTH) * zoom;
  }

  screenToWorld(camera: CameraView, screenX: number, screenY: number): Vec2 {
    const ppu = this.pixelsPerUnit(camera.zoom);
    return {
      x: camera.x + (screenX - this.canvas.width / 2) / ppu,
      y: camera.y + (screenY - this.canvas.height / 2) / ppu,
    };
  }

  worldToScreen(camera: CameraView, p: Vec2): Vec2 {
    const ppu = this.pixelsPerUnit(camera.zoom);
    return {
      x: this.canvas.width / 2 + (p.x - camera.x) * ppu,
      y: this.canvas.height / 2 + (p.y - camera.y) * ppu,
    };
  }

  render(scene: RenderScene): void {
    const ctx = this.ctx;
    const { canvas } = this;
    const ppu = this.pixelsPerUnit(scene.camera.zoom);

    // Sky.
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0c1526');
    grad.addColorStop(0.55, '#1b2b3f');
    grad.addColorStop(1, '#2c3b30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const toScreen = (p: Vec2) => this.worldToScreen(scene.camera, p);

    // Decor (near layer, behind structure).
    for (const d of scene.decor) {
      if (d.id === 'decor_sky') continue;
      const s = toScreen({ x: d.x, y: d.y });
      drawPlaceholder(ctx, s.x, s.y, 0, scaleShape(d.shape, ppu), { fill: d.color, stroke: d.strokeColor });
    }

    // Ground.
    const groundTop = toScreen({ x: scene.worldWidth / 2, y: scene.groundY });
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(0, groundTop.y, canvas.width, canvas.height - groundTop.y);
    ctx.strokeStyle = '#e8482c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundTop.y);
    ctx.lineTo(canvas.width, groundTop.y);
    ctx.stroke();

    // Structural pieces.
    for (const piece of scene.pieces.values()) {
      const pos = piece.body.position;
      const s = toScreen(pos);
      const mat = getMaterial(piece.material);
      drawPlaceholder(ctx, s.x, s.y, piece.body.angle, scaleShape(piece.visual.shape, ppu), {
        fill: mat.color,
        stroke: mat.strokeColor,
        damage: 1 - piece.integrity,
        broken: piece.broken,
      });
    }

    // Launcher device (placeholder).
    this.drawLauncher(toScreen(scene.launcherOrigin), scene.launcherAim, ppu);

    // Trajectory preview.
    if (scene.trajectoryPreview) {
      ctx.save();
      for (let i = 0; i < scene.trajectoryPreview.length; i++) {
        const s = toScreen(scene.trajectoryPreview[i]);
        const alpha = 1 - i / scene.trajectoryPreview.length;
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(2, 4 * (this.dpr)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Projectiles.
    for (const proj of scene.projectiles.values()) {
      const s = toScreen(proj.body.position);
      drawPlaceholder(ctx, s.x, s.y, proj.body.angle, scaleShape(proj.visual.shape, ppu), {
        fill: proj.config.color,
        stroke: '#1a1a1a',
      });
    }

    // Particles (already in world space via a temporary transform).
    ctx.save();
    ctx.translate(canvas.width / 2 - scene.camera.x * ppu, canvas.height / 2 - scene.camera.y * ppu);
    ctx.scale(ppu, ppu);
    ctx.lineWidth = 1 / ppu;
    scene.particles.render(ctx);
    ctx.restore();

    if (scene.showColliders) this.drawDebugColliders(scene, toScreen);
  }

  private drawLauncher(screenPos: Vec2, aim: Vec2 | null, ppu: number): void {
    const ctx = this.ctx;
    const angle = aim ? Math.atan2(aim.y, aim.x) : 0;
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#3a4149';
    ctx.strokeStyle = '#1a1d22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(-10 * ppu, -14 * ppu, 70 * ppu, 28 * ppu);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#e8482c';
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 22 * ppu, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1d22';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawDebugColliders(scene: RenderScene, toScreen: (p: Vec2) => Vec2): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#5bff8a';
    ctx.lineWidth = 1.5;
    const bodies = Matter.Composite.allBodies(scene.physics.world);
    for (const body of bodies) {
      ctx.beginPath();
      body.vertices.forEach((v, i) => {
        const s = toScreen(v);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.stroke();
      const c = toScreen(body.position);
      ctx.fillStyle = '#5bff8a';
      ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
    }

    ctx.strokeStyle = '#5ad1ff';
    const constraints = Matter.Composite.allConstraints(scene.physics.world);
    for (const c of constraints) {
      const pa = c.bodyA ? Matter.Vector.add(c.bodyA.position, c.pointA) : c.pointA;
      const pb = c.bodyB ? Matter.Vector.add(c.bodyB.position, c.pointB) : c.pointB;
      const sa = toScreen(pa);
      const sb = toScreen(pb);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function scaleShape(shape: { kind: 'rectangle'; width: number; height: number } | { kind: 'circle'; radius: number }, ppu: number) {
  if (shape.kind === 'rectangle') return { kind: 'rectangle' as const, width: shape.width * ppu, height: shape.height * ppu };
  return { kind: 'circle' as const, radius: shape.radius * ppu };
}
