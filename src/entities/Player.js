/**
 * PLAYER — control, integridad y EXPOSICIÓN.
 *
 * `exposure` (0..1) es la variable de diseño más importante del jugador: la
 * luz que produces al disparar te vuelve visible. La IA no consulta si has
 * disparado, consulta cuánto brillas. Así cualquier fuente de luz futura
 * (bengalas, lámparas rotas, un enemigo ardiendo) te delatará gratis, sin
 * tocar la IA.
 */

import { Config } from '../config/Config.js';
import { Weapon } from './Weapon.js';
import { clamp, TAU, rgba } from '../core/MathUtils.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.weapon = new Weapon(game, this);
    this.reset();
  }

  reset() {
    const s = this.game.level.playerSpawn;
    this.x = s.x; this.y = s.y;
    this.vx = 0; this.vy = 0;
    this.aimAngle = 0;
    this.health = Config.player.health;
    this.alive = true;
    this.exposure = 0;
    this.invuln = 0;
    this.stepTimer = 0;
    this.hitFlash = 0;
    this.weapon.reset();
  }

  update(dt, input) {
    const P = Config.player;
    if (!this.alive) return;

    this.#aim(input);

    // Movimiento: aceleración + rozamiento. El rozamiento (y no un tope duro)
    // es lo que da peso al personaje y hace legible el empujón del retroceso.
    this.vx += input.moveX * P.accel * dt;
    this.vy += input.moveY * P.accel * dt;
    const damping = Math.exp(-P.friction * dt);
    this.vx *= damping; this.vy *= damping;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > P.maxSpeed) {
      const k = P.maxSpeed / speed;
      this.vx *= k; this.vy *= k;
    }

    const res = this.game.level.moveCircle(this, this.vx, this.vy, P.radius, dt);
    this.vx = res.vx; this.vy = res.vy;

    // Pasos: moverse también hace ruido. Correr a ciegas tiene precio.
    if (speed > 40) {
      this.stepTimer -= dt * (speed / P.maxSpeed);
      if (this.stepTimer <= 0) {
        this.stepTimer = P.footstepInterval;
        this.game.audio.play('step', this.x, this.y);
        this.game.emitSound(this.x, this.y, P.footstepLoudness, 'step');
      }
    } else {
      this.stepTimer = P.footstepInterval * 0.4;
    }

    // Exposición = lo que decae de tu último fogonazo, o la luz que te está
    // bañando ahora mismo. Lo que sea mayor. Salir de la luz te devuelve la
    // invisibilidad; quedarte en ella no.
    this.exposure = Math.max(
      Math.max(0, this.exposure - P.exposureDecay * dt),
      this.game.lightAt(this.x, this.y),
    );
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);

    this.weapon.update(dt, input.firing, input.reloadQueued);
  }

  #aim(input) {
    if (input.aimMode === 'point') {
      const wx = this.game.camera.toWorldX(input.aimPointX);
      const wy = this.game.camera.toWorldY(input.aimPointY);
      this.aimAngle = Math.atan2(wy - this.y, wx - this.x);
    } else if (input.aimStrength > 0) {
      // Con stick, si sueltas el dedo se conserva el último ángulo: soltar
      // para reposicionar el pulgar no debe girar el arma al norte.
      this.aimAngle = Math.atan2(input.aimDirY, input.aimDirX);
    }
  }

  takeDamage(amount, dirX = 0, dirY = 0) {
    if (!this.alive || this.invuln > 0) return;
    this.health -= amount;
    this.invuln = Config.player.invulnAfterHit;
    this.hitFlash = 1;
    this.game.camera.shake(0.55);
    this.game.audio.play('hurt', this.x, this.y);
    this.vx += dirX * 150;
    this.vy += dirY * 150;
    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.game.effects.death(this.x, this.y, [1.0, 0.3, 0.3]);
    this.game.audio.play('playerDie', this.x, this.y);
    this.game.camera.shake(1.0);
    this.game.onPlayerDeath();
  }

  /** Luz propia: mínima. Suficiente para no perderte, insuficiente para ver. */
  submitLights(lighting) {
    if (!this.alive) return;
    const P = Config.player;
    lighting.add(this.x, this.y, P.auraRadius, P.auraIntensity, [0.55, 0.75, 1.0], true);
  }

  /** Capa dinámica: el cuerpo, solo visible cuando algo lo ilumina. */
  render(ctx, cam) {
    if (!this.alive) return;
    const P = Config.player;
    const sx = this.x - cam.x, sy = this.y - cam.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.aimAngle);

    ctx.fillStyle = '#cfe4ff';
    ctx.beginPath();
    ctx.arc(0, 0, P.radius, 0, TAU);
    ctx.fill();

    // Arma: un trazo que retrocede al disparar. Barato y muy legible.
    const kick = this.weapon.kick;
    ctx.strokeStyle = '#8fb4dd';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(P.radius - 2 - kick, 0);
    ctx.lineTo(P.radius + 10 - kick, 0);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Capa emisiva: la silueta mínima permanente. Es la única concesión a la
   * legibilidad — sin ella no sabes ni dónde estás, y eso no es tensión,
   * es frustración.
   */
  renderEmissive(ctx, cam) {
    if (!this.alive) return;
    const P = Config.player;
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const pulse = 0.85 + Math.sin(this.game.time * 3.1) * 0.15;

    let a = P.silhouetteAlpha * pulse;
    if (this.invuln > 0) a *= 0.45 + 0.55 * Math.abs(Math.sin(this.game.time * 26));

    ctx.strokeStyle = rgba([0.65, 0.85, 1.0], a);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sx, sy, P.radius + 1, 0, TAU);
    ctx.stroke();

    // Marca de apuntado: una muesca corta, no un láser. Un láser resolvería
    // la oscuridad gratis y el juego dejaría de ir de lo que va.
    const a2 = Math.min(1, a * 1.5);
    ctx.strokeStyle = rgba([0.75, 0.9, 1.0], a2);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(this.aimAngle) * (P.radius + 7), sy + Math.sin(this.aimAngle) * (P.radius + 7));
    ctx.lineTo(sx + Math.cos(this.aimAngle) * (P.radius + 15), sy + Math.sin(this.aimAngle) * (P.radius + 15));
    ctx.stroke();

    if (this.hitFlash > 0) {
      ctx.fillStyle = rgba([1, 0.25, 0.25], this.hitFlash * 0.6);
      ctx.beginPath();
      ctx.arc(sx, sy, P.radius + 6 * this.hitFlash, 0, TAU);
      ctx.fill();
    }
  }
}
