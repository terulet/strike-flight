/**
 * ENEMY AI — máquina de estados de percepción.
 *
 *   IDLE        patrulla lenta. No sabe que existes.
 *   SUSPICIOUS  ha OÍDO algo. Sabe aproximadamente dónde, no qué.
 *   ALERT       te VE. Persigue y dispara.
 *   LOST        te ha perdido. Busca alrededor de tu última posición conocida.
 *
 * Regla innegociable: el enemigo NO tiene visión mágica. Vive en la misma
 * oscuridad que tú. Su alcance visual va de `visionRangeDark` (estás a
 * oscuras) a `visionRange` (acabas de disparar y brillas). El disparo es lo
 * que te vuelve visible, y eso es lo que hace que dudes antes de apretar.
 *
 * El oído introduce error a propósito (`hearingError`): un enemigo que
 * caminase exactamente a tu posición al oír un disparo sería un GPS, y la
 * oscuridad dejaría de protegerte.
 *
 * La navegación es dirección + bigotes anticolisión, sin pathfinding. En una
 * arena de una pantalla el A* no aporta nada que el jugador pueda percibir,
 * y sí aporta complejidad que habría que mantener.
 */

import { Config } from '../config/Config.js';
import { rng } from '../core/Rng.js';
import { clamp, angleDelta, TAU } from '../core/MathUtils.js';

export const State = {
  IDLE: 'IDLE',
  SUSPICIOUS: 'SUSPICIOUS',
  ALERT: 'ALERT',
  LOST: 'LOST',
};

/** Longitud de los bigotes de anticolisión, en px. */
const WHISKER = 62;
const WHISKER_ANGLES = [0, -0.62, 0.62, -1.25, 1.25];

export class EnemyAI {
  constructor(enemy, game) {
    this.enemy = enemy;
    this.game = game;
    this.reset();
  }

  reset() {
    this.state = State.IDLE;
    this.stateTime = 0;
    this.targetX = this.enemy.x;
    this.targetY = this.enemy.y;
    this.hasTarget = false;
    this.lastKnownX = 0;
    this.lastKnownY = 0;
    this.hasLastKnown = false;
    this.seeTimer = 0;
    this.loseTimer = 0;
    this.repathTimer = 0;
    this.attackTimer = rng.range(0, Config.enemy.attackInterval);
    this.windup = 0;
    this.moveX = 0;
    this.moveY = 0;
    this.canSeePlayer = false;
    this.stuckTimer = 0;
    this.lastX = this.enemy.x;
    this.lastY = this.enemy.y;
  }

  /**
   * Antiatasco.
   *
   * La navegación es dirección + bigotes, sin pathfinding: basta para una
   * arena de una pantalla, pero tiene un modo de fallo conocido — un recoveco
   * en el que todas las direcciones tanteadas chocan y el enemigo se queda
   * empujando una pared indefinidamente. No es un problema de balance, es un
   * enemigo roto a la vista, y eso arruina una sesión de pruebas entera.
   *
   * Si lleva un rato con destino y sin avanzar, se le cambia el destino.
   */
  #unstick(dt) {
    const e = this.enemy;
    const moved = Math.hypot(e.x - this.lastX, e.y - this.lastY);
    this.lastX = e.x;
    this.lastY = e.y;

    if (!this.hasTarget || moved > 0.35) { this.stuckTimer = 0; return; }
    this.stuckTimer += dt;
    if (this.stuckTimer < Config.enemy.stuckTime) return;

    this.stuckTimer = 0;
    const p = this.game.level.randomFloorPoint(rng, e.x, e.y, 320);
    this.targetX = p.x;
    this.targetY = p.y;
    this.repathTimer = rng.range(1.5, 3.0);
  }

  /**
   * Ha VISTO el fogonazo.
   *
   * Es el cierre del bucle del juego. Hasta aquí, disparar te delataba de
   * dos formas indirectas: el ruido (que llega con error) y la exposición
   * (que solo cuenta si el enemigo ya estaba mirando en tu dirección y a
   * distancia). Pero un fogonazo en un pasillo a oscuras no es una pista
   * sutil: es la única fuente de luz de la habitación y se ve.
   *
   * Requiere línea de visión, y ese requisito es el que crea la textura
   * táctica: disparar a un muro desde detrás de una esquina hace ruido pero
   * no te enseña. Disparar a lo que tienes delante, sí.
   */
  onMuzzleFlash(x, y) {
    const E = Config.enemy;
    const e = this.enemy;
    const dx = x - e.x, dy = y - e.y;
    if (Math.hypot(dx, dy) > E.flashSightRange) return false;
    // Cono generoso: un destello así se pilla de reojo, no hace falta
    // estarlo mirando de frente. Solo se escapa lo que queda a la espalda.
    if (Math.abs(angleDelta(e.dir, Math.atan2(dy, dx))) > E.flashFov * 0.5) return false;
    if (!this.game.level.hasLineOfSight(e.x, e.y, x, y)) return false;
    this.onAttacked(x, y);
    return true;
  }

  /**
   * Le han DISPARADO. No es un ruido lejano: sabe exactamente de dónde vino
   * y responde de inmediato.
   *
   * Medido con tools/playtest.mjs: cuando recibir un tiro solo lo pasaba a
   * SUSPICIOUS, el enemigo caminaba hacia ti mientras lo rematabas y el bot
   * despejó el nivel veinte veces seguidas sin recibir un impacto. Un enemigo
   * que no puede devolverte el golpe deja el "riesgo" del disparo en teoría.
   */
  onAttacked(x, y) {
    this.lastKnownX = x;
    this.lastKnownY = y;
    this.hasLastKnown = true;
    this.targetX = x;
    this.targetY = y;
    this.hasTarget = true;
    this.loseTimer = 0;
    if (this.state !== State.ALERT) {
      this.#setState(State.ALERT);
      // Ya estaba avisado: no le regalamos otra vez el tiempo de reacción.
      this.attackTimer = Math.min(this.attackTimer, Config.enemy.attackWindup);
    }
  }

  /** Un ruido llegó hasta aquí. `error` ya viene aplicado por Game. */
  onSound(x, y, kind) {
    const E = Config.enemy;
    if (this.state === State.ALERT) return; // ya te está mirando

    const nx = x + rng.spread(E.hearingError);
    const ny = y + rng.spread(E.hearingError);
    this.#setState(State.SUSPICIOUS);
    this.targetX = nx;
    this.targetY = ny;
    this.hasTarget = true;
    this.repathTimer = 0.6;
  }

  update(dt) {
    const E = Config.enemy;
    const e = this.enemy;
    const player = this.game.player;

    this.stateTime += dt;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.#unstick(dt);

    this.canSeePlayer = this.#perceive(player);

    if (this.canSeePlayer) {
      this.seeTimer += dt;
      this.loseTimer = 0;
      this.lastKnownX = player.x;
      this.lastKnownY = player.y;
      this.hasLastKnown = true;
      if (this.state !== State.ALERT && this.seeTimer >= E.reacquireDelay) {
        this.#setState(State.ALERT);
        this.game.audio.play('alert', e.x, e.y);
      }
    } else {
      this.seeTimer = 0;
      if (this.state === State.ALERT) {
        this.loseTimer += dt;
        if (this.loseTimer >= E.loseSightGrace) {
          this.#setState(State.LOST);
          this.targetX = this.lastKnownX;
          this.targetY = this.lastKnownY;
          this.hasTarget = true;
        }
      }
    }

    switch (this.state) {
      case State.IDLE: this.#idle(dt); break;
      case State.SUSPICIOUS: this.#suspicious(dt); break;
      case State.ALERT: this.#alert(dt, player); break;
      case State.LOST: this.#lost(dt); break;
    }
  }

  get speed() {
    const E = Config.enemy;
    switch (this.state) {
      case State.ALERT: return E.speedAlert;
      case State.SUSPICIOUS: return E.speedSuspicious;
      case State.LOST: return E.speedLost;
      default: return E.speedPatrol;
    }
  }

  /**
   * ¿Ve al jugador?
   * alcance = f(exposición del jugador) → disparar es hacerse visible.
   */
  #perceive(player) {
    if (!player.alive) return false;
    const E = Config.enemy;
    const e = this.enemy;

    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);

    let range = E.visionRangeDark + (E.visionRange - E.visionRangeDark) * player.exposure;
    // En ALERT no se vuelve ciego de golpe al apagarse tu fogonazo: te sigue
    // teniendo delante. Sin esta holgura el combate parpadea sin parar.
    if (this.state === State.ALERT) range = Math.max(range, E.visionRange * 0.72);
    if (d > range) return false;

    // Cono de visión. A bocajarro no hay cono que valga: te tiene encima.
    if (d > E.radius + Config.player.radius + 26) {
      const toPlayer = Math.atan2(dy, dx);
      if (Math.abs(angleDelta(e.dir, toPlayer)) > E.visionFov * 0.5) return false;
    }

    return this.game.level.hasLineOfSight(e.x, e.y, player.x, player.y);
  }

  #setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.stateTime = 0;
    this.repathTimer = 0;
  }

  #idle(dt) {
    this.repathTimer -= dt;
    const reached = this.hasTarget && Math.hypot(this.targetX - this.enemy.x, this.targetY - this.enemy.y) < 40;
    if (!this.hasTarget || reached || this.repathTimer <= 0) {
      const p = this.game.level.randomFloorPoint(rng, this.enemy.x, this.enemy.y, 420);
      this.targetX = p.x; this.targetY = p.y;
      this.hasTarget = true;
      this.repathTimer = rng.range(3.5, 7.0);
    }
    this.#steerTo(this.targetX, this.targetY);
  }

  #suspicious(dt) {
    const E = Config.enemy;
    const d = Math.hypot(this.targetX - this.enemy.x, this.targetY - this.enemy.y);
    if (d < 46) {
      // Ha llegado al origen del ruido y no hay nadie: mira alrededor.
      this.repathTimer -= dt;
      if (this.repathTimer <= 0) {
        const p = this.game.level.randomFloorPoint(rng, this.targetX, this.targetY, E.searchRadius);
        this.targetX = p.x; this.targetY = p.y;
        this.repathTimer = rng.range(0.8, 1.6);
      }
    }
    this.#steerTo(this.targetX, this.targetY);
    if (this.stateTime > E.suspiciousTime) this.#setState(State.IDLE);
  }

  #alert(dt, player) {
    const E = Config.enemy;
    const e = this.enemy;
    const d = Math.hypot(player.x - e.x, player.y - e.y);

    // Se acerca hasta la distancia de tiro y ahí se planta.
    if (d > E.attackRange * 0.78) this.#steerTo(player.x, player.y);
    else { this.moveX = 0; this.moveY = 0; }

    // Encara siempre al jugador: en ALERT sí sabe dónde estás.
    e.faceTarget = Math.atan2(player.y - e.y, player.x - e.x);

    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) e.shoot(player);
      return;
    }
    if (d <= E.attackRange && this.attackTimer <= 0 && this.canSeePlayer) {
      // Aviso previo antes de disparar: el jugador puede oírlo y apartarse.
      this.windup = E.attackWindup;
      this.attackTimer = E.attackInterval;
      e.onWindup();
    }
  }

  #lost(dt) {
    const E = Config.enemy;
    const d = Math.hypot(this.targetX - this.enemy.x, this.targetY - this.enemy.y);
    if (d < 46) {
      this.repathTimer -= dt;
      if (this.repathTimer <= 0) {
        const p = this.game.level.randomFloorPoint(rng, this.lastKnownX, this.lastKnownY, E.searchRadius);
        this.targetX = p.x; this.targetY = p.y;
        this.repathTimer = rng.range(0.7, 1.4);
      }
    }
    this.#steerTo(this.targetX, this.targetY);
    if (this.stateTime > E.lostTime) {
      this.hasLastKnown = false;
      this.#setState(State.IDLE);
    }
  }

  /**
   * Dirección deseada + bigotes: si el camino recto está bloqueado, prueba
   * desvíos crecientes a izquierda y derecha y se queda con el primero libre.
   * No es pathfinding — es lo justo para no quedarse clavado en una esquina.
   */
  #steerTo(tx, ty) {
    const e = this.enemy;
    const dx = tx - e.x, dy = ty - e.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) { this.moveX = 0; this.moveY = 0; return; }

    const base = Math.atan2(dy, dx);
    const reach = Math.min(WHISKER, len);
    for (const off of WHISKER_ANGLES) {
      const a = base + off;
      const hit = this.game.level.raycast(e.x, e.y, Math.cos(a), Math.sin(a), reach);
      if (!hit.hit) {
        this.moveX = Math.cos(a);
        this.moveY = Math.sin(a);
        return;
      }
    }
    // Encerrado: gira sobre sí mismo hasta que algo se abra.
    const a = base + Math.PI * 0.5;
    this.moveX = Math.cos(a);
    this.moveY = Math.sin(a);
  }

  /** Color del estado. Solo lo usa el HUD de debug. */
  get debugColor() {
    return {
      [State.IDLE]: '#5f9fd0',
      [State.SUSPICIOUS]: '#e0c04a',
      [State.ALERT]: '#ff4a44',
      [State.LOST]: '#c07ae0',
    }[this.state];
  }
}
