/**
 * WEAPON — un solo disparo, pero que haga TRES cosas a la vez.
 *
 *   ATAQUE   puede matar
 *   VISIÓN   revela el escenario en tres oleadas
 *   RIESGO   te delata por sonido Y por luz
 *
 * El tercer punto es el que convierte el juego en un juego. Aquí se aplica
 * en dos canales independientes a propósito: `emitSound` (la IA acude al
 * origen) y `player.exposure` (la IA te VE mientras estás iluminado). Ceder
 * uno sin el otro haría la mecánica plana.
 *
 * La munición no es un sistema de recursos: es lo que impide que "disparar
 * para ver" degenere en mantener el gatillo pulsado. Si la quitas
 * (Config.weapon.infiniteAmmo) la oscuridad deja de importar — pruébalo, se
 * nota en dos partidas.
 */

import { Config } from '../config/Config.js';
import { rng } from '../core/Rng.js';
import { clamp } from '../core/MathUtils.js';

export class Weapon {
  constructor(game, owner) {
    this.game = game;
    this.owner = owner;
    this.reset();
  }

  reset() {
    const W = Config.weapon;
    this.cooldown = 0;
    this.mag = W.magSize;
    this.reserve = W.reserveAmmo;
    this.reloading = 0;
    this.spread = W.spread;
    this.kick = 0;          // retroceso visual del cañón, en px
    this.shotsFired = 0;
    this.lastShotAt = -99;
  }

  get isReloading() { return this.reloading > 0; }
  get canReload() {
    return !this.isReloading && this.mag < Config.weapon.magSize && this.reserve > 0;
  }

  update(dt, wantsFire, wantsReload) {
    const W = Config.weapon;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.spread = Math.max(W.spread, this.spread - W.spreadRecover * dt);
    this.kick = Math.max(0, this.kick - W.recoilRecover * dt * (1 + this.kick));

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.#finishReload();
      return;
    }

    if (wantsReload && this.canReload) { this.startReload(); return; }

    if (wantsFire && this.cooldown <= 0) {
      if (W.infiniteAmmo || this.mag > 0) this.#fire();
      else this.#dryFire();
    }
  }

  startReload() {
    if (!this.canReload) return;
    this.reloading = Config.weapon.reloadTime;
    this.game.audio.play('reload', this.owner.x, this.owner.y,
      { delay: Config.weapon.reloadTime * 1000 * 0.75 });
  }

  #finishReload() {
    const W = Config.weapon;
    const need = W.magSize - this.mag;
    const take = Math.min(need, this.reserve);
    this.mag += take;
    this.reserve -= take;
    this.reloading = 0;
  }

  #dryFire() {
    this.cooldown = 0.22;
    this.game.audio.play('dryFire', this.owner.x, this.owner.y);
    if (Config.touch.autoReload && this.canReload) this.startReload();
  }

  #fire() {
    const W = Config.weapon;
    const L = Config.lighting;
    const g = this.game;
    const o = this.owner;

    this.cooldown = W.fireInterval;
    if (!W.infiniteAmmo) this.mag--;
    this.shotsFired++;
    this.lastShotAt = g.time;

    const angle = o.aimAngle + rng.spread(this.spread);
    this.spread = Math.min(W.spreadMax, this.spread + W.spreadPerShot);

    // Boca del arma, no centro del cuerpo: el fogonazo debe nacer donde mira.
    const mx = o.x + Math.cos(o.aimAngle) * (Config.player.radius + 9);
    const my = o.y + Math.sin(o.aimAngle) * (Config.player.radius + 9);

    // 1 · ATAQUE + 2 · VISIÓN
    g.projectiles.spawn(mx, my, angle, W.projectileSpeed, 'player', W.damage,
      L.projectile.tint, L.projectile.radius, L.projectile.intensity, W.projectileLife);
    g.lighting.flash(mx, my, L.muzzle.radius, L.muzzle.intensity, L.muzzle.tint, L.muzzle.duration);
    g.effects.muzzle(mx, my, o.aimAngle);
    g.effects.shell(o.x, o.y, o.aimAngle);
    g.audio.play('shot', o.x, o.y);
    g.audio.play('shell', o.x, o.y);
    g.camera.shake(W.shakeOnFire);

    // 3 · RIESGO — dos canales distintos, a propósito.
    g.emitSound(o.x, o.y, W.shotLoudness, 'shot');
    o.exposure = clamp(o.exposure + W.shotExposure, 0, 1);

    // Retroceso: empuje real hacia atrás + sacudida del cañón.
    o.vx -= Math.cos(o.aimAngle) * W.recoilImpulse;
    o.vy -= Math.sin(o.aimAngle) * W.recoilImpulse;
    this.kick = W.recoilKick;

    if (this.mag <= 0 && Config.touch.autoReload) this.startReload();
  }
}
