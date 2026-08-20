/**
 * GAME — orquestación.
 *
 * Aquí no vive ninguna mecánica: vive el orden en el que ocurren, y el
 * pegamento entre sistemas que no deben conocerse entre sí. Si algo empieza
 * a parecerse a una regla del juego, es que le toca su propio módulo.
 *
 * La excepción deliberada es `emitSound()`, porque el sonido ES una regla:
 * es el canal por el que disparar te delata. Está aquí, en un único sitio y
 * en catorce líneas, para que se pueda releer entero mientras se balancea.
 */

import { Config } from '../config/Config.js';
import { Level } from '../systems/Level.js';
import { Lighting } from '../systems/Lighting.js';
import { Renderer } from '../systems/Renderer.js';
import { Effects } from '../systems/Effects.js';
import { Audio } from '../systems/Audio.js';
import { Camera } from './Camera.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectiles } from '../entities/Projectiles.js';
import { Hud } from '../ui/Hud.js';
import { Debug } from '../ui/Debug.js';
import { Input } from '../input/Input.js';
import { rng } from './Rng.js';
import { clamp, TAU, rgba } from './MathUtils.js';

/** dt máximo por fotograma. Una pestaña en segundo plano no teletransporta a nadie. */
const MAX_DT = 1 / 20;
/** Margen antes de aceptar el reinicio: que la muerte se vea antes de saltarla. */
const RESTART_LOCKOUT = 0.7;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.level = new Level();
    this.camera = new Camera(this.level);
    this.lighting = new Lighting(this.level);
    this.renderer = new Renderer(canvas, this.level);
    this.effects = new Effects(this.level);
    this.audio = new Audio();
    this.input = new Input(canvas);
    this.projectiles = new Projectiles(this);
    this.player = new Player(this);
    this.hud = new Hud(this);
    this.debug = new Debug(this);

    // Config colgado del juego: el panel de debug y la consola lo tocan en
    // caliente, y así `LAST_LIGHT.config.world.ambient = 0.2` funciona.
    this.config = Config;

    this.enemies = [];
    this.pickups = [];
    this.lamps = [];
    this.soundEvents = [];   // solo para visualizar en debug

    this.time = 0;
    this.freeze = 0;
    this.state = 'playing';
    this.stateTime = 0;
    this.fps = 60;
    this.frameMs = 0;
    // Desglose del coste del fotograma. Sin esto, "va lento" no es un dato:
    // optimizar a ciegas es cómo se pierden tardes enteras.
    this.perf = { update: 0, static: 0, light: 0, compose: 0, entities: 0 };

    // Del INTENTO: se reinician con cada partida, son lo que muestra el
    // marcador al morir. Antes eran acumuladas y el marcador iba sumando
    // bajas de intentos anteriores — números sin sentido justo en el momento
    // en el que el jugador decide si repite.
    this.stats = { shots: 0, hits: 0, kills: 0 };
    // De la SESIÓN: sobreviven al reinicio.
    this.session = { runs: 1, best: 0, totalKills: 0 };
    this.reset(true);
  }

  reset(hard = false) {
    rng.seed = (Math.random() * 0xffffffff) >>> 0;
    this.time = 0;
    this.freeze = 0;
    this.state = 'playing';
    this.stateTime = 0;
    this.soundEvents.length = 0;

    this.lighting.reset();
    this.effects.reset();
    this.projectiles.reset();
    this.player.reset();

    this.enemies.length = 0;
    for (const s of this.level.enemySpawns) this.enemies.push(new Enemy(this, s.x, s.y));

    // Un cargador por caja, ni uno más: la munición se encuentra explorando
    // a oscuras, y explorar a oscuras cuesta balas. Ese es el bucle.
    this.pickups = this.level.ammoSpawns.map((s) => ({
      x: s.x, y: s.y, taken: false, amount: Config.weapon.magSize,
    }));

    this.lamps = this.level.lampSpawns.map((s, i) => ({
      x: s.x, y: s.y, flicker: 1, phase: rng.range(0, TAU), rate: rng.range(0.7, 2.1),
    }));

    this.stats.shots = 0;
    this.stats.hits = 0;
    this.stats.kills = 0;

    this.camera.snapTo(this.player.x, this.player.y);
    if (!hard) this.session.runs++;
  }

  /* ───────────────────────── ciclo principal ───────────────────────── */

  frame(dtRaw) {
    const t0 = performance.now();
    const dt = Math.min(dtRaw, MAX_DT);
    // Media móvil: un contador de fps que salta cada frame no sirve para nada.
    this.fps += ((1 / Math.max(1e-4, dtRaw)) - this.fps) * 0.08;

    const tU = performance.now();
    if (this.freeze > 0) {
      // Hit-stop: el mundo se para, la presentación no. Es lo que hace que
      // un impacto se sienta como un impacto y no como restar un número.
      this.freeze -= dtRaw;
    } else {
      this.update(dt);
    }
    this.#track('update', tU);
    this.render(dt);

    this.input.endFrame();
    this.frameMs += (performance.now() - t0 - this.frameMs) * 0.1;
  }

  /** Media móvil de un tramo del fotograma, en ms. */
  #track(key, t0) {
    this.perf[key] += (performance.now() - t0 - this.perf[key]) * 0.1;
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    this.input.touch.update();

    if (this.state !== 'playing') {
      if (this.stateTime > RESTART_LOCKOUT && (this.input.restartQueued || this.input.tapped)) {
        this.reset();
        return;
      }
    } else {
      const before = this.player.weapon.shotsFired;
      this.player.update(dt, this.input);
      this.stats.shots += this.player.weapon.shotsFired - before;
    }

    for (const e of this.enemies) e.update(dt);
    this.projectiles.update(dt);
    this.effects.update(dt);
    this.lighting.update(dt);
    this.#updatePickups();
    this.#updateLamps(dt);
    this.#updateSoundEvents(dt);

    this.camera.update(dt, this.player.x, this.player.y,
      Math.cos(this.player.aimAngle), Math.sin(this.player.aimAngle));

    this.audio.setListener(this.player.x, this.player.y);
    this.audio.updateBreath(this.#nearestEnemyDist());

    if (this.input.debugToggled) Config.debug.enabled = !Config.debug.enabled;
    if (this.input.paramPanelToggled) this.debug.togglePanel();
    if (this.input.restartQueued && this.state === 'playing') this.reset();
  }

  /* ─────────────────────────── el SONIDO ───────────────────────────── */

  /**
   * Publica un ruido en el mundo. Todo lo que delata al jugador pasa por
   * aquí: disparos, pasos, impactos.
   *
   * Las paredes no bloquean el sonido, lo amortiguan. Un disparo al otro
   * lado de un muro se oye, pero peor localizado — que es exactamente lo que
   * hace interesante disparar a una pared para desviar la atención.
   */
  emitSound(x, y, loudness, kind) {
    if (loudness <= 0) return;
    if (Config.debug.enabled) {
      this.soundEvents.push({ x, y, r: loudness, life: 0.9, maxLife: 0.9, kind });
      if (this.soundEvents.length > 24) this.soundEvents.shift();
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      const blocked = !this.level.hasLineOfSight(e.x, e.y, x, y);
      const reach = Math.min(loudness, Config.enemy.hearingRange) * (blocked ? 0.62 : 1);
      if (d <= reach) e.ai.onSound(x, y, kind);
    }
  }

  /**
   * Cuánta luz baña un punto del mundo, 0..1.
   *
   * Existe para que `player.exposure` signifique de verdad "cuánto brillas",
   * y no solo "acabas de disparar". Con esto, quedarse quieto bajo una luz de
   * emergencia te delata igual que un fogonazo: la luz deja de ser solo una
   * herramienta y pasa a ser también terreno peligroso. Las lámparas del
   * nivel se vuelven sitios que hay que cruzar, no sitios donde estar.
   *
   * Solo mira lámparas y destellos: las luces diminutas (el aura del jugador,
   * el brillo de un enemigo) no deberían delatar a nadie.
   */
  lightAt(x, y) {
    let total = 0;
    const consider = (lx, ly, radius, intensity) => {
      if (radius < 90 || intensity <= 0.05) return;
      const d = Math.hypot(lx - x, ly - y);
      if (d > radius) return;
      const falloff = 1 - d / radius;
      if (!this.level.hasLineOfSight(lx, ly, x, y)) return;
      total += intensity * falloff * falloff;
    };
    for (const l of this.lamps) consider(l.x, l.y, 190 * l.flicker, 0.62 * l.flicker);
    for (const l of this.lighting.timedLights) {
      consider(l.x, l.y, l.radius, l.intensity * (l.life / l.maxLife));
    }
    return clamp(total, 0, 1);
  }

  /**
   * Un fogonazo acaba de ocurrir en (x, y). Los enemigos con línea de visión
   * lo ven. Es la contrapartida directa de "disparar te permite ver".
   */
  flashSeen(x, y) {
    let seen = 0;
    for (const e of this.enemies) {
      if (e.alive && e.ai.onMuzzleFlash(x, y)) seen++;
    }
    return seen;
  }

  /* ──────────────────────────── enganches ──────────────────────────── */

  hitStop(ms) { this.freeze = Math.max(this.freeze, ms / 1000); }

  onEnemyKilled() {
    this.stats.kills++;
    this.session.totalKills++;
    if (this.enemies.every((e) => !e.alive) && this.state === 'playing') {
      this.state = 'cleared';
      this.stateTime = 0;
      this.session.best = this.session.best > 0
        ? Math.min(this.session.best, this.time)
        : this.time;
    }
  }

  onPlayerDeath() {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.stateTime = 0;
  }

  /* ──────────────────────────── internos ───────────────────────────── */

  #nearestEnemyDist() {
    let best = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < best) best = d;
    }
    return best;
  }

  #updatePickups() {
    const p = this.player;
    if (!p.alive) return;
    for (const it of this.pickups) {
      if (it.taken) continue;
      if (Math.hypot(it.x - p.x, it.y - p.y) > Config.player.radius + 16) continue;
      if (p.weapon.reserve >= Config.weapon.reserveAmmo * 3) continue;  // ya va lleno
      it.taken = true;
      p.weapon.reserve += it.amount;
      this.audio.play('pickup', it.x, it.y);
      this.lighting.flash(it.x, it.y, 150, 0.9, [0.5, 1.0, 0.75], 0.25);
    }
  }

  #updateLamps(dt) {
    for (const l of this.lamps) {
      l.phase += dt * l.rate;
      // Parpadeo de emergencia: ruido suave + caídas ocasionales. Una luz
      // perfectamente estable no da miedo, y aquí el miedo es el producto.
      const n = Math.sin(l.phase * 3.1) * 0.5 + Math.sin(l.phase * 7.7) * 0.28;
      l.flicker = clamp(0.72 + n * 0.3, 0.12, 1.05);
      if (Math.sin(l.phase * 0.9) > 0.985) l.flicker *= 0.15;
    }
  }

  #updateSoundEvents(dt) {
    for (let i = this.soundEvents.length - 1; i >= 0; i--) {
      const s = this.soundEvents[i];
      s.life -= dt;
      if (s.life <= 0) this.soundEvents.splice(i, 1);
    }
  }

  /* ───────────────────────────── dibujado ──────────────────────────── */

  render(dt) {
    const cam = this.camera;
    const r = this.renderer;

    const tS = performance.now();
    r.clearLayers();
    r.drawStatic(cam);
    this.#track('static', tS);

    // Capa dinámica: solo existe bajo luz viva.
    const tE = performance.now();
    const dyn = r.dynL.ctx;
    this.effects.renderLit(dyn, cam);
    for (const it of this.pickups) if (!it.taken) this.#drawPickup(dyn, cam, it);
    for (const e of this.enemies) e.render(dyn, cam);
    this.player.render(dyn, cam);

    // Luces del fotograma.
    this.lighting.frameLights.length = 0;
    this.player.submitLights(this.lighting);
    for (const e of this.enemies) e.submitLights(this.lighting);
    for (const l of this.lamps) {
      this.lighting.add(l.x, l.y, 190 * l.flicker, 0.62 * l.flicker, [1.0, 0.62, 0.32], true);
    }
    this.#track('entities', tE);

    const tL = performance.now();
    this.lighting.build(cam.x, cam.y, dt);
    this.#track('light', tL);

    // Capa emisiva: luz propia, la oscuridad no la tapa.
    const emis = r.emisL.ctx;
    this.effects.renderEmissive(emis, cam);
    this.projectiles.renderEmissive(emis, cam);
    r.drawLamps(cam, this.lamps, this.time);
    for (const it of this.pickups) if (!it.taken) this.#drawPickupGlow(emis, cam, it);
    for (const e of this.enemies) e.renderEmissive(emis, cam);
    this.player.renderEmissive(emis, cam);

    const tC = performance.now();
    r.compose(this.lighting, cam);
    this.#track('compose', tC);

    // HUD y debug van directos a pantalla: no los toca la iluminación.
    const ctx = r.ctx;
    ctx.save();
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    this.hud.render(ctx, r.viewW, r.viewH);
    this.input.touch.render(ctx);
    if (Config.debug.enabled) this.debug.render(ctx, r.viewW, r.viewH);
    ctx.restore();
  }

  #drawPickup(ctx, cam, it) {
    const sx = it.x - cam.x, sy = it.y - cam.y;
    ctx.fillStyle = '#4fd6a0';
    ctx.fillRect(sx - 6, sy - 4, 12, 8);
    ctx.strokeStyle = '#0d2b22';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 6, sy - 4, 12, 8);
  }

  #drawPickupGlow(ctx, cam, it) {
    const sx = it.x - cam.x, sy = it.y - cam.y;
    const pulse = 0.4 + Math.sin(this.time * 2.6 + it.x * 0.01) * 0.22;
    ctx.fillStyle = rgba([0.35, 1.0, 0.7], pulse);
    ctx.beginPath();
    ctx.arc(sx, sy, 2.2, 0, TAU);
    ctx.fill();
  }

  resize() {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    this.renderer.resize(w, h, window.devicePixelRatio || 1);
    this.camera.resize(this.renderer.viewW, this.renderer.viewH);
    this.lighting.resize(this.renderer.viewW, this.renderer.viewH);
    this.input.touch.setViewport(this.renderer.viewW, this.renderer.viewH);
  }
}
