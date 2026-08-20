/**
 * PROJECTILES — el proyectil es una LINTERNA que además hace daño.
 *
 * Es la segunda capa de la revelación: fogonazo (dónde estoy) → trayectoria
 * (qué hay en el camino) → impacto (qué hay al final). Por eso cada bala
 * arrastra su propia luz y por eso el impacto merece su propio destello.
 *
 * Colisión continua: a 1150 px/s una bala recorre ~19 px por fotograma y una
 * celda mide 48, así que el paso discreto "casi" bastaría. "Casi" no sirve:
 * con lag o a 30 fps atravesaría paredes. Se traza el segmento completo.
 */

import { Config } from '../config/Config.js';
import { Pool } from '../core/Pool.js';
import { rgba } from '../core/MathUtils.js';

const MAX_PROJECTILES = 120;

const makeProjectile = () => ({
  x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
  life: 0, radius: 2.5, damage: 1, owner: 'player',
  tint: [1, 1, 1], lightRadius: 0, lightIntensity: 0,
});

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.pool = new Pool(makeProjectile, MAX_PROJECTILES);
  }

  reset() { this.pool.clear(); }
  get count() { return this.pool.active; }

  spawn(x, y, angle, speed, owner, damage, tint, lightRadius, lightIntensity, life) {
    const p = this.pool.obtain();
    if (!p) return null;    // techo duro: preferimos perder una bala a perder fps
    p.x = p.px = x;
    p.y = p.py = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = life;
    p.owner = owner;
    p.damage = damage;
    p.tint = tint;
    p.radius = Config.weapon.projectileRadius;
    p.lightRadius = lightRadius;
    p.lightIntensity = lightIntensity;
    return p;
  }

  update(dt) {
    const { level, effects, lighting, audio, enemies, player } = this.game;

    this.pool.forEach((p, i) => {
      p.life -= dt;
      if (p.life <= 0) { this.pool.release(i); return; }

      p.px = p.x; p.py = p.y;
      let dx = p.vx * dt, dy = p.vy * dt;
      let travel = Math.hypot(dx, dy);
      if (travel < 1e-6) return;
      const ux = dx / travel, uy = dy / travel;

      // ¿Choca con la geometría antes de terminar el paso?
      const hit = level.raycast(p.x, p.y, ux, uy, travel);
      let stopAt = hit.hit ? hit.dist : travel;

      // ¿Y con alguien, antes que con la pared?
      const target = this.#firstTarget(p, ux, uy, stopAt, enemies, player);
      if (target) {
        p.x += ux * target.dist;
        p.y += uy * target.dist;
        this.#hitEntity(p, target.entity, ux, uy);
        this.pool.release(i);
        return;
      }

      p.x += ux * stopAt;
      p.y += uy * stopAt;

      if (hit.hit) {
        // Se retira un pelo de la pared: si el destello nace DENTRO del muro,
        // el polígono de visibilidad degenera y la luz no se ve.
        const bx = p.x + hit.nx * 2.5;
        const by = p.y + hit.ny * 2.5;
        const L = Config.lighting.impact;
        lighting.flash(bx, by, L.radius, L.intensity, p.tint, L.duration);
        effects.impact(bx, by, hit.nx, hit.ny);
        audio.play('impact', bx, by);
        // El impacto también es ruido: el enemigo puede acudir al PUNTO DE
        // IMPACTO en vez de a ti. Disparar a otra parte es una herramienta.
        this.game.emitSound(bx, by, Config.weapon.shotLoudness * 0.45, 'impact');
        this.pool.release(i);
        return;
      }

      // La bala ilumina su propio recorrido mientras viaja.
      const L = Config.lighting.projectile;
      lighting.add(p.x, p.y, p.lightRadius, p.lightIntensity, p.tint, L.castsShadows);
    });
  }

  /** Objetivo más cercano cortado por el segmento de vuelo, o null. */
  #firstTarget(p, ux, uy, maxDist, enemies, player) {
    let best = null;
    const check = (e, r) => {
      if (!e || !e.alive) return;
      const ex = e.x - p.x, ey = e.y - p.y;
      const along = ex * ux + ey * uy;              // proyección sobre el vuelo
      if (along < -r || along > maxDist + r) return;
      const perp = Math.abs(ex * uy - ey * ux);     // distancia perpendicular
      const reach = r + p.radius;
      if (perp > reach) return;
      // Retrocede hasta el borde del círculo: el impacto se ve en la piel.
      const back = Math.sqrt(Math.max(0, reach * reach - perp * perp));
      const d = Math.max(0, along - back);
      if (d > maxDist) return;
      if (!best || d < best.dist) best = { dist: d, entity: e };
    };

    if (p.owner === 'player') {
      for (const e of enemies) check(e, Config.enemy.radius);
    } else {
      check(player, Config.player.radius);
    }
    return best;
  }

  #hitEntity(p, entity, ux, uy) {
    const { effects, audio, lighting } = this.game;
    effects.bloodMist(p.x, p.y, Math.atan2(uy, ux));
    lighting.flash(p.x, p.y, Config.lighting.impact.radius * 0.55,
      Config.lighting.impact.intensity * 0.8, p.tint, Config.lighting.impact.duration * 0.7);
    audio.play(p.owner === 'player' ? 'enemyHit' : 'hurt', p.x, p.y);
    if (p.owner === 'player') this.game.stats.hits++;
    entity.takeDamage(p.damage, ux, uy);
  }

  /** El cuerpo de la bala es luz pura: va a la capa emisiva. */
  renderEmissive(ctx, cam) {
    this.pool.forEach((p) => {
      const sx = p.x - cam.x, sy = p.y - cam.y;
      const tx = p.px - cam.x, ty = p.py - cam.y;

      // Estela: el rastro del fotograma anterior. Da sensación de velocidad
      // sin tener que simular nada.
      const grad = ctx.createLinearGradient(tx, ty, sx, sy);
      grad.addColorStop(0, rgba(p.tint, 0));
      grad.addColorStop(1, rgba(p.tint, 0.75));
      ctx.strokeStyle = grad;
      ctx.lineWidth = p.radius * 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.fillStyle = rgba(p.tint, 1);
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
