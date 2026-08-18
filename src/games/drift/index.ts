/**
 * DRIFT - supervivencia.
 *
 * Regla unica: aguanta. Arrastra el dedo (o usa las flechas) para colar la
 * nave por los huecos. Cada muro superado suma, y rozarlo suma mas.
 *
 * Aqui vive el sistema de fantasma: un riel a la derecha marca hasta donde
 * llego el rival del dia. Pasar esa marca es un momento, no una linea de log.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { backdropGrid, hexToRgba, label, roundRect } from '../../game/draw';
import { GHOST_SAMPLE_MS, sampleAt } from '../../net/ghost';

const ACCENT = '#a78bfa';
const DANGER = '#ff2d55';

interface Wall {
  y: number;
  gapX: number;
  gapW: number;
  passed: boolean;
  grazed: boolean;
  height: number;
}

interface Block {
  x: number;
  y: number;
  vx: number;
  size: number;
}

export const META: GameMeta = {
  id: 'drift',
  name: 'DRIFT',
  tagline: 'Aguanta. Roza los muros para puntuar mas.',
  skill: 'supervivencia',
  defaultDurationMs: 40_000,
  instructions: [
    'Arrastra el dedo para mover la nave. Tambien vale con las flechas.',
    'Pasa por los huecos. Un choque y se acaba.',
    'Rozar el muro sin chocar da bonus. Sobrevivir da puntos cada segundo.',
  ],
  icon: '△',
  accent: ACCENT,
  supportsGhost: true,
  scoreLabel: 'PTS',
  supportedMutators: ['rush', 'heavy', 'blackout', 'mirror', 'swarm', 'sprint', 'double', 'tiny', 'chaos'],
};

class DriftGame extends BaseMiniGame {
  readonly meta = META;

  private playerX = 0;
  private playerVX = 0;
  private targetX = 0;
  private walls: Wall[] = [];
  private blocks: Block[] = [];
  private spawnTimer = 0;
  private scroll = 0;
  private survivalCarry = 0;
  private wallsPassed = 0;
  private grazes = 0;
  private hasPointer = false;
  /** Traza propia para el fantasma: una muestra cada 100 ms. */
  private trace: number[] = [];
  private traceTimer = 0;
  private ghostX: number | null = null;
  private ghostAlive = false;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
    this.playerX = this.width / 2;
    this.targetX = this.width / 2;
  }

  private get playerY(): number {
    return this.areaTop + this.areaHeight * 0.82;
  }

  private get playerRadius(): number {
    return Math.max(9, Math.min(this.width, this.areaHeight) * 0.034);
  }

  private get scrollSpeed(): number {
    // Sube con el tiempo: los ultimos segundos tienen que doler.
    const ramp = 1 + this.progress * 0.85 + this.config.difficulty * 0.3;
    return this.areaHeight * 0.46 * ramp * this.mut.speed;
  }

  protected setup(): void {
    this.playerX = this.width / 2;
    this.targetX = this.width / 2;
    this.playerVX = 0;
    this.walls = [];
    this.blocks = [];
    this.spawnTimer = 0.6;
    this.scroll = 0;
    this.survivalCarry = 0;
    this.wallsPassed = 0;
    this.grazes = 0;
    this.hasPointer = false;
    this.trace = [];
    this.traceTimer = 0;
    this.ghostX = null;
    this.ghostAlive = Boolean(this.config.ghost?.samples?.length);
    this.tracksAccuracy = false;
    this.setLives(1);

    for (let i = 0; i < this.mut.extraHazards; i++)
      this.spawnBlock(this.areaTop + this.areaHeight * (0.2 + i * 0.18));
  }

  protected tick(dt: number): void {
    this.scroll += this.scrollSpeed * dt;

    this.recordTrace(dt);
    this.updateGhost();
    this.updatePlayer(dt);
    this.updateWalls(dt);
    this.updateBlocks(dt);

    // Puntos por segundo vivo (acumulados para no marear con flotantes).
    this.survivalCarry += dt * 70;
    if (this.survivalCarry >= 70) {
      const chunk = Math.floor(this.survivalCarry);
      this.survivalCarry -= chunk;
      this.addScore(chunk, this.playerX, this.playerY - 40, { silent: true });
    }

    this.checkGhost();
  }

  /** Guarda donde estaba la nave, normalizado, para que otro pueda revivirlo. */
  private recordTrace(dt: number): void {
    this.traceTimer -= dt * 1000;
    if (this.traceTimer > 0) return;
    this.traceTimer += GHOST_SAMPLE_MS;
    if (this.trace.length < 1800) this.trace.push(this.playerX / Math.max(1, this.width));
  }

  /** Posicion del rival en este instante, si trae traza real. */
  private updateGhost(): void {
    const ghost = this.config.ghost;
    if (!ghost?.samples?.length) {
      this.ghostX = null;
      return;
    }
    const value = sampleAt(ghost.samples, this.elapsedMs, ghost.sampleMs ?? GHOST_SAMPLE_MS);
    if (value === null) {
      // Se ha acabado su intento: a partir de aqui corres solo.
      if (this.ghostAlive && this.ghostX !== null) {
        this.services.fx.burst(this.ghostX * this.width, this.playerY, {
          count: 14,
          color: 'rgba(226,232,240,0.9)',
          speed: 200,
          size: 3,
        });
      }
      this.ghostAlive = false;
      this.ghostX = null;
      return;
    }
    this.ghostX = value;
  }

  private updatePlayer(dt: number): void {
    const input = this.services.input;
    if (input.down) this.hasPointer = true;
    if (this.hasPointer && input.down) {
      this.targetX = this.pointerX();
    }
    const axis = this.axisX();
    if (axis !== 0) {
      this.hasPointer = false;
      this.targetX += axis * this.width * 1.35 * dt;
    }
    this.targetX = Math.max(this.playerRadius, Math.min(this.width - this.playerRadius, this.targetX));

    // GRAVEDAD X2 = el doble de inercia: cuesta mas frenar.
    const responsiveness = 15 / this.mut.gravity;
    const damping = 1 - Math.min(0.9, 7 * dt) / this.mut.gravity;
    this.playerVX += (this.targetX - this.playerX) * responsiveness * dt;
    this.playerVX *= damping;
    this.playerX += this.playerVX * dt * 60 * 0.06 + (this.targetX - this.playerX) * Math.min(1, dt * 8);
    this.playerX = Math.max(this.playerRadius, Math.min(this.width - this.playerRadius, this.playerX));
  }

  private updateWalls(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const interval = Math.max(0.42, (1.15 - this.progress * 0.45) / Math.max(0.5, this.mut.spawnRate));
      this.spawnTimer = interval;
      this.spawnWall();
    }

    const speed = this.scrollSpeed;
    const radius = this.playerRadius;
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const wall = this.walls[i] as Wall;
      wall.y += speed * dt;
      if (wall.y > this.height + wall.height) {
        this.walls.splice(i, 1);
        continue;
      }

      const overlapY = this.playerY + radius > wall.y && this.playerY - radius < wall.y + wall.height;
      const insideGap =
        this.playerX - radius > wall.gapX && this.playerX + radius < wall.gapX + wall.gapW;

      if (overlapY && !insideGap) {
        this.crash(wall);
        return;
      }

      // Roce: pasar pegado al borde del hueco.
      if (overlapY && insideGap && !wall.grazed) {
        const margin = Math.min(this.playerX - radius - wall.gapX, wall.gapX + wall.gapW - this.playerX - radius);
        if (margin < radius * 0.75) {
          wall.grazed = true;
          this.grazes++;
          const combo = this.bumpCombo();
          this.addScore(50 + Math.min(10, combo) * 10, this.playerX, this.playerY - 30);
          this.services.fx.ring(this.playerX, this.playerY, radius * 3.2, ACCENT, 2.5);
        }
      }

      if (!wall.passed && wall.y > this.playerY + radius) {
        wall.passed = true;
        this.wallsPassed++;
        this.addScore(100, this.playerX, this.playerY - 54);
        this.services.haptics.fire('tick');
      }
    }
  }

  private updateBlocks(dt: number): void {
    const radius = this.playerRadius;
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const block = this.blocks[i] as Block;
      block.y += this.scrollSpeed * 0.85 * dt;
      block.x += block.vx * dt;
      if (block.x < block.size / 2 || block.x > this.width - block.size / 2) block.vx *= -1;
      if (block.y > this.height + block.size) {
        this.blocks.splice(i, 1);
        continue;
      }
      const dx = Math.abs(block.x - this.playerX);
      const dy = Math.abs(block.y - this.playerY);
      if (dx < block.size / 2 + radius * 0.8 && dy < block.size / 2 + radius * 0.8) {
        this.crashAt(block.x, block.y);
        return;
      }
    }
  }

  private spawnWall(): void {
    const minGap = this.width * 0.24;
    const maxGap = this.width * 0.42;
    const tighten = 1 - this.progress * 0.3 - this.config.difficulty * 0.12;
    const gapW = Math.max(
      this.playerRadius * 3.2,
      this.rng.range(minGap, maxGap) * tighten * this.mut.sizeMultiplier,
    );
    const gapX = this.rng.range(this.width * 0.04, this.width * 0.96 - gapW);
    this.walls.push({
      y: this.areaTop - this.areaHeight * 0.06,
      gapX,
      gapW,
      passed: false,
      grazed: false,
      height: Math.max(16, this.areaHeight * 0.03),
    });
    if (this.mut.extraHazards > 0 && this.rng.chance(0.35)) this.spawnBlock(this.areaTop - this.areaHeight * 0.1);
  }

  private spawnBlock(y: number): void {
    const size = Math.max(14, this.width * 0.075 * this.mut.sizeMultiplier);
    this.blocks.push({
      x: this.rng.range(size, this.width - size),
      y,
      vx: this.rng.range(-this.width * 0.22, this.width * 0.22) * this.mut.speed,
      size,
    });
  }

  private crash(wall: Wall): void {
    const x = this.playerX < wall.gapX ? wall.gapX : wall.gapX + wall.gapW;
    this.crashAt(x, wall.y + wall.height / 2);
  }

  private crashAt(x: number, y: number): void {
    this.services.fx.burst(this.playerX, this.playerY, { count: 30, color: DANGER, speed: 340, size: 5 });
    this.services.fx.burst(x, y, { count: 14, color: '#ffffff', speed: 240, size: 3 });
    this.services.fx.shake(1.1);
    this.services.fx.flash(DANGER, 0.45);
    this.services.audio.play('hit');
    this.services.haptics.fire('heavy');
    this.registerMistake(0); // vidas = 1 -> termina la partida
  }

  private checkGhost(): void {
    const ghost = this.config.ghost;
    if (!ghost || ghost.kind !== 'time') return;
    if (this.elapsedMs >= ghost.value) {
      this.passGhost(`${ghost.rivalName} ${(ghost.value / 1000).toFixed(1)} s`);
    }
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, ACCENT, -this.scroll, 44);

    // Muros
    for (const wall of this.walls) {
      const color = wall.passed ? hexToRgba(ACCENT, 0.35) : ACCENT;
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      roundRect(ctx, 0, wall.y, wall.gapX, wall.height, 4);
      ctx.fill();
      roundRect(ctx, wall.gapX + wall.gapW, wall.y, this.width - (wall.gapX + wall.gapW), wall.height, 4);
      ctx.fill();
      ctx.restore();

      // Marcas del hueco: ayudan a leer el paso de un vistazo.
      ctx.save();
      ctx.strokeStyle = hexToRgba('#ffffff', wall.passed ? 0.12 : 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wall.gapX + 2, wall.y + wall.height + 8);
      ctx.lineTo(wall.gapX + 2, wall.y - 8);
      ctx.moveTo(wall.gapX + wall.gapW - 2, wall.y + wall.height + 8);
      ctx.lineTo(wall.gapX + wall.gapW - 2, wall.y - 8);
      ctx.stroke();
      ctx.restore();
    }

    // Bloques
    for (const block of this.blocks) {
      ctx.save();
      ctx.fillStyle = DANGER;
      ctx.shadowColor = DANGER;
      ctx.shadowBlur = 14;
      ctx.translate(block.x, block.y);
      ctx.rotate((this.elapsedSeconds * 2 + block.x) % (Math.PI * 2));
      roundRect(ctx, -block.size / 2, -block.size / 2, block.size, block.size, 4);
      ctx.fill();
      ctx.restore();
    }

    this.drawGhostRail();
    this.drawGhostShip();
    this.drawPlayer();
  }

  /** Nave del rival: se ve, pero no estorba. */
  private drawGhostShip(): void {
    if (this.ghostX === null) return;
    const ctx = this.ctx;
    const r = this.playerRadius;
    const x = this.ghostX * this.width;
    const y = this.playerY;

    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.translate(x, y);
    ctx.fillStyle = '#e2e8f0';
    ctx.shadowColor = 'rgba(226,232,240,0.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.15);
    ctx.lineTo(r * 0.9, r * 0.8);
    ctx.lineTo(0, r * 0.4);
    ctx.lineTo(-r * 0.9, r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.55;
    label(ctx, this.config.ghost?.rivalName ?? 'RIVAL', x, y + r * 2.1, {
      size: 10,
      color: '#e2e8f0',
      weight: 800,
    });
    ctx.restore();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    const r = this.playerRadius;
    const tilt = Math.max(-0.5, Math.min(0.5, (this.targetX - this.playerX) / 90));
    ctx.save();
    ctx.translate(this.playerX, this.playerY);
    ctx.rotate(tilt);

    // Estela
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.5);
    ctx.lineTo(r * 0.5, r * 0.5);
    ctx.lineTo(0, r * 2.2);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.lineTo(r, r * 0.85);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r, r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Riel de progreso con la marca del rival. */
  private drawGhostRail(): void {
    const ghost = this.config.ghost;
    const ctx = this.ctx;
    const x = this.width - 16;
    const top = this.areaTop + this.areaHeight * 0.06;
    const bottom = this.areaTop + this.areaHeight * 0.92;
    const span = bottom - top;
    const total = Math.max(1, this.config.durationMs);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    const mine = Math.min(1, this.elapsedMs / total);
    ctx.strokeStyle = ACCENT;
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, bottom - span * mine);
    ctx.stroke();
    ctx.restore();

    if (!ghost || ghost.kind !== 'time') return;
    const gy = bottom - span * Math.min(1, ghost.value / total);
    const passed = this.elapsedMs >= ghost.value;
    ctx.save();
    ctx.globalAlpha = passed ? 0.45 : 1;
    ctx.strokeStyle = passed ? 'rgba(124,243,192,0.9)' : '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 12, gy);
    ctx.lineTo(x + 6, gy);
    ctx.stroke();
    // Fondo oscuro detras del texto: la marca tiene que leerse aunque pase un
    // muro justo por detras.
    const text = `${ghost.rivalName} ${(ghost.value / 1000).toFixed(1)}s`;
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(7,7,13,0.72)';
    roundRect(ctx, x - 22 - textWidth, gy - 20, textWidth + 10, 17, 5);
    ctx.fill();
    label(ctx, text, x - 16, gy - 11, {
      size: 12,
      align: 'right',
      color: passed ? 'rgba(124,243,192,0.95)' : 'rgba(226,232,240,0.95)',
      weight: 700,
    });
    ctx.restore();

    // Silueta a media pantalla: solo cuando NO hay traza real, para no
    // duplicar informacion (con traza ya se ve la nave del rival).
    if (!passed && !this.config.ghost?.samples?.length) {
      const dist = Math.abs(gy - (bottom - span * mine));
      const near = Math.max(0, 1 - dist / (span * 0.35));
      if (near > 0.02) {
        ctx.save();
        ctx.globalAlpha = 0.1 + near * 0.35;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 26px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        const ghostY = this.areaTop + this.areaHeight * 0.14;
        ctx.fillText('👻', this.width * 0.5, ghostY);
        ctx.font = '800 13px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(`${ghost.rivalName} ${(ghost.value / 1000).toFixed(1)} s`, this.width * 0.5, ghostY + 24);
        ctx.restore();
      }
    }
  }

  protected override metrics(): Record<string, number> {
    return { wallsPassed: this.wallsPassed, grazes: this.grazes };
  }

  /** Traza de esta partida, para subirla si ha sido la mejor del dia. */
  recording(): { sampleMs: number; samples: number[] } | null {
    if (this.trace.length < 3) return null;
    return { sampleMs: GHOST_SAMPLE_MS, samples: this.trace.slice() };
  }

  debugInfo(): Record<string, unknown> {
    return {
      game: 'drift',
      ghostX: this.ghostX,
      traceLength: this.trace.length,
      player: { x: this.playerX, y: this.playerY, r: this.playerRadius },
      walls: this.walls.map((w) => ({ y: w.y, gapX: w.gapX, gapW: w.gapW, h: w.height })),
      blocks: this.blocks.map((b) => ({ x: b.x, y: b.y, size: b.size })),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new DriftGame(services, config),
};
