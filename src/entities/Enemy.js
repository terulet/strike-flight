/**
 * ENEMY — cuerpo, integridad y presentación.
 *
 * La decisión visual importante: el cuerpo del enemigo vive en la capa
 * DINÁMICA, así que solo existe mientras algo lo ilumina. Lo único
 * permanente son sus ojos, y son tenues. Un enemigo a oscuras es un par de
 * puntos que quizá se han movido, quizá no.
 *
 * Los ojos no son un regalo: también son la pista que te deja disparar con
 * criterio en vez de a ciegas. Y se encienden al alertarse, así que ver dos
 * puntos ponerse rojos en la oscuridad es toda la información que necesitas
 * para saber que la has liado.
 */

import { Config } from '../config/Config.js';
import { EnemyAI, State } from './EnemyAI.js';
import { rng } from '../core/Rng.js';
import { rotateToward, TAU, rgba, clamp } from '../core/MathUtils.js';

export class Enemy {
  constructor(game, x, y) {
    this.game = game;
    this.spawnX = x;
    this.spawnY = y;
    this.ai = new EnemyAI(this, game);
    this.reset();
  }

  reset() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0; this.vy = 0;
    this.dir = rng.range(0, TAU);
    this.faceTarget = this.dir;
    this.health = Config.enemy.health;
    this.alive = true;
    this.stepTimer = rng.range(0, Config.enemy.footstepInterval);
    this.hitFlash = 0;
    this.eyeGlow = 0;
    this.ai.reset();
  }

  get state() { return this.ai.state; }

  update(dt) {
    if (!this.alive) return;
    const E = Config.enemy;

    this.ai.update(dt);

    const speed = this.ai.speed;
    this.vx += this.ai.moveX * E.accel * dt;
    this.vy += this.ai.moveY * E.accel * dt;
    const damping = Math.exp(-E.friction * dt);
    this.vx *= damping; this.vy *= damping;

    const v = Math.hypot(this.vx, this.vy);
    if (v > speed) { this.vx *= speed / v; this.vy *= speed / v; }

    const res = this.game.level.moveCircle(this, this.vx, this.vy, E.radius, dt);
    this.vx = res.vx; this.vy = res.vy;

    // Encara hacia donde va, salvo que la IA imponga un objetivo (ALERT).
    const want = this.ai.state === State.ALERT
      ? this.faceTarget
      : (v > 8 ? Math.atan2(this.vy, this.vx) : this.dir);
    this.dir = rotateToward(this.dir, want, 5.2 * dt);

    // Sus pasos son TU sonar. Cuanto más rápido va, más te avisa.
    if (v > 15) {
      this.stepTimer -= dt * (v / Math.max(1, E.speedAlert));
      if (this.stepTimer <= 0) {
        this.stepTimer = E.footstepInterval;
        this.game.audio.play('enemyStep', this.x, this.y);
      }
    }

    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    const wantGlow = this.ai.state === State.ALERT ? 1 : this.ai.state === State.SUSPICIOUS ? 0.45 : 0;
    this.eyeGlow += (wantGlow - this.eyeGlow) * Math.min(1, dt * 7);
  }

  /** Aviso previo: los ojos se encienden un instante antes del disparo. */
  onWindup() {
    this.eyeGlow = 1.4;
    this.game.audio.play('alert', this.x, this.y);
  }

  shoot(player) {
    if (!this.alive) return;
    const E = Config.enemy;
    const L = Config.lighting.enemyMuzzle;
    const angle = Math.atan2(player.y - this.y, player.x - this.x) + rng.spread(0.09);
    const mx = this.x + Math.cos(angle) * (E.radius + 6);
    const my = this.y + Math.sin(angle) * (E.radius + 6);

    this.game.projectiles.spawn(mx, my, angle, E.projectileSpeed, 'enemy', E.attackDamage,
      L.tint, Config.lighting.projectile.radius * 0.7, Config.lighting.projectile.intensity * 0.8, 2.2);
    // Su fogonazo también le delata a él: la regla vale para los dos bandos.
    this.game.lighting.flash(mx, my, L.radius, L.intensity, L.tint, L.duration);
    this.game.effects.muzzle(mx, my, angle);
    this.game.audio.play('enemyShot', this.x, this.y);
    this.game.emitSound(this.x, this.y, Config.weapon.shotLoudness * 0.7, 'enemyShot');
  }

  takeDamage(amount, dirX = 0, dirY = 0) {
    if (!this.alive) return;
    this.health -= amount;
    this.hitFlash = 1;
    this.vx += dirX * 90;
    this.vy += dirY * 90;
    this.game.camera.shake(Config.weapon.shakeOnHit);
    this.game.hitStop(Config.weapon.hitStopMs);

    if (this.health <= 0) {
      this.die(dirX, dirY);
      return;
    }
    // Recibir un tiro es saber exactamente de dónde vino.
    this.ai.onSound(this.game.player.x, this.game.player.y, 'hit');
  }

  die(dirX = 0, dirY = 0) {
    this.alive = false;
    this.game.effects.death(this.x, this.y, [1.0, 0.45, 0.35]);
    // Muere iluminando: el último destello te enseña dónde estabas peleando.
    this.game.lighting.flash(this.x, this.y, 240, 1.5, [1.0, 0.5, 0.35], 0.28);
    this.game.audio.play('enemyDie', this.x, this.y);
    this.game.camera.shake(Config.weapon.shakeOnKill);
    this.game.hitStop(Config.weapon.hitStopKillMs);
    this.game.emitSound(this.x, this.y, Config.weapon.shotLoudness * 0.35, 'death');
    this.game.onEnemyKilled(this);
  }

  /** Capa dinámica: el cuerpo. Solo existe bajo luz viva. */
  render(ctx, cam) {
    if (!this.alive) return;
    const E = Config.enemy;
    const sx = this.x - cam.x, sy = this.y - cam.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.dir);

    ctx.fillStyle = this.hitFlash > 0
      ? `rgb(255,${Math.round(180 - 120 * this.hitFlash)},${Math.round(180 - 140 * this.hitFlash)})`
      : '#b9484a';
    ctx.beginPath();
    // Cuerpo con proa: se lee de un vistazo hacia dónde mira.
    ctx.moveTo(E.radius * 1.35, 0);
    ctx.lineTo(-E.radius * 0.85, -E.radius * 0.9);
    ctx.lineTo(-E.radius * 0.5, 0);
    ctx.lineTo(-E.radius * 0.85, E.radius * 0.9);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e88a7a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  /** Capa emisiva: los ojos. Única información permanente del enemigo. */
  renderEmissive(ctx, cam) {
    if (!this.alive) return;
    const E = Config.enemy;
    const player = this.game.player;
    const d = Math.hypot(this.x - player.x, this.y - player.y);
    if (d > E.eyeRange) return;

    // Se apagan con la distancia: un enemigo lejano es un rumor, no un punto.
    const falloff = clamp(1 - d / E.eyeRange, 0, 1);
    const base = E.eyeAlphaIdle + (E.eyeAlphaAlert - E.eyeAlphaIdle) * clamp(this.eyeGlow, 0, 1);
    const a = base * (0.45 + falloff * 0.55);
    if (a <= 0.004) return;

    const sx = this.x - cam.x, sy = this.y - cam.y;
    const tint = this.eyeGlow > 0.5 ? [1.0, 0.28, 0.22] : [1.0, 0.55, 0.42];
    const sep = 4.2;
    const nx = Math.cos(this.dir), ny = Math.sin(this.dir);
    const px = -ny, py = nx;   // perpendicular

    ctx.fillStyle = rgba(tint, Math.min(1, a));
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx + nx * E.radius * 0.7 + px * sep * s,
              sy + ny * E.radius * 0.7 + py * sep * s,
              1.5 + this.eyeGlow * 0.9, 0, TAU);
      ctx.fill();
    }

    if (this.hitFlash > 0) {
      ctx.fillStyle = rgba([1, 0.4, 0.3], this.hitFlash * 0.5);
      ctx.beginPath();
      ctx.arc(sx, sy, E.radius + 8 * this.hitFlash, 0, TAU);
      ctx.fill();
    }
  }

  /** En ALERT emite un halo propio: te ve y te lo hace saber. */
  submitLights(lighting) {
    if (!this.alive) return;
    const g = clamp(this.eyeGlow, 0, 1.4);
    if (g < 0.35) return;
    lighting.add(this.x, this.y, 62 * g, 0.10 * g, [1.0, 0.3, 0.25], false);
  }
}
