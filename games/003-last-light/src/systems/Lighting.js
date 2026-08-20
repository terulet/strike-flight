/**
 * LIGHTING — el corazón técnico de LAST LIGHT.
 *
 * No es un filtro negro por encima del juego: es una máscara de luz real,
 * con oclusión por geometría, que decide qué existe visualmente y qué no.
 *
 * Produce dos máscaras cada fotograma:
 *
 *   liveMask      luz que existe AHORA. Revela geometría Y entidades.
 *   combinedMask  live + ambiente + MEMORIA. Revela solo geometría.
 *
 * Que las entidades salgan únicamente en `liveMask` es la regla de diseño
 * más importante del proyecto: el jugador recuerda la habitación, pero no
 * recuerda dónde está el enemigo. Todo el juego vive en esa diferencia.
 *
 * La memoria (`memMask`) se guarda en ESPACIO DE MUNDO, no de pantalla: si
 * viviera en pantalla, se arrastraría al mover la cámara. Cuesta un lienzo
 * de nivel × maskScale, que en esta arena es 1104×720 — nada.
 *
 * Coste: todas las máscaras se renderizan a `Config.lighting.maskScale` de
 * la resolución. Es la diferencia entre 60 y 30 fps en un iPhone.
 */

import { Config } from '../config/Config.js';
import { TAU, raySegment, rgba, clamp } from '../core/MathUtils.js';

/** Rayos de relleno: mantienen el círculo redondo donde no hay obstáculos. */
const FILLER_RAYS = 18;
/** Desvío angular a cada lado de una esquina, para que la luz la rebase. */
const CORNER_EPS = 0.0002;

export class Lighting {
  constructor(level) {
    this.level = level;
    this.scale = Config.lighting.maskScale;

    // Luces enviadas este fotograma (persistentes: aura, lámparas, proyectiles).
    this.frameLights = [];
    // Luces con vida propia (fogonazos, impactos). Se reciclan.
    this.timedLights = [];
    this.timedFree = [];

    this.liveMask = document.createElement('canvas');
    this.liveCtx = this.liveMask.getContext('2d');
    this.combinedMask = document.createElement('canvas');
    this.combinedCtx = this.combinedMask.getContext('2d');

    // Memoria visual: espacio de mundo, persistente entre fotogramas.
    this.memMask = document.createElement('canvas');
    this.memMask.width = Math.ceil(level.width * this.scale);
    this.memMask.height = Math.ceil(level.height * this.scale);
    this.memCtx = this.memMask.getContext('2d');

    this.viewW = 0;
    this.viewH = 0;
    this.activeCount = 0;      // diagnóstico para el panel de debug
    this.shadowCount = 0;

    // Reutilizadas cada fotograma: cero asignaciones en el bucle.
    this._segs = [];
    this._angles = [];
    this._poly = [];
  }

  resize(viewW, viewH) {
    if (this.viewW === viewW && this.viewH === viewH) return;
    this.viewW = viewW;
    this.viewH = viewH;
    const w = Math.ceil(viewW * this.scale);
    const h = Math.ceil(viewH * this.scale);
    this.liveMask.width = w; this.liveMask.height = h;
    this.combinedMask.width = w; this.combinedMask.height = h;
  }

  reset() {
    this.frameLights.length = 0;
    this.timedFree.push(...this.timedLights);
    this.timedLights.length = 0;
    this.memCtx.clearRect(0, 0, this.memMask.width, this.memMask.height);
  }

  /** Luz para ESTE fotograma. La reenvía su dueño cada vez. */
  add(x, y, radius, intensity, tint, castsShadows = true) {
    if (this.frameLights.length + this.timedLights.length >= Config.lighting.maxLights) return;
    this.frameLights.push({ x, y, radius, intensity, tint, castsShadows });
  }

  /**
   * Destello con vida propia: fogonazo, impacto. Se apaga solo.
   * @param {number} duration segundos de vida
   */
  flash(x, y, radius, intensity, tint, duration, castsShadows = true) {
    if (this.timedLights.length >= Config.lighting.maxLights) return null;
    const l = this.timedFree.pop() || {};
    l.x = x; l.y = y; l.radius = radius; l.intensity = intensity;
    l.tint = tint; l.castsShadows = castsShadows;
    l.life = duration; l.maxLife = duration;
    this.timedLights.push(l);
    return l;
  }

  update(dt) {
    for (let i = this.timedLights.length - 1; i >= 0; i--) {
      const l = this.timedLights[i];
      l.life -= dt;
      if (l.life <= 0) {
        this.timedFree.push(l);
        this.timedLights.splice(i, 1);
      }
    }
  }

  /**
   * Genera las máscaras del fotograma.
   * @param {number} camX,camY  esquina superior izquierda de la vista, en mundo
   */
  build(camX, camY, dt) {
    const s = this.scale;
    const ctx = this.liveCtx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.liveMask.width, this.liveMask.height);
    ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s);
    ctx.globalCompositeOperation = 'lighter';

    // Se dibujan las más fuertes primero: si hay que recortar por presupuesto,
    // lo que se pierde es el destello más débil, que nadie va a echar de menos.
    const lights = this.#collectVisible(camX, camY);
    this.activeCount = lights.length;
    this.shadowCount = 0;

    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const withShadows = l.castsShadows && this.shadowCount < Config.lighting.maxShadowCasters;
      if (withShadows) this.shadowCount++;
      this.#drawLight(ctx, l, withShadows);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    this.#updateMemory(camX, camY, dt);
    this.#buildCombined(camX, camY);
  }

  /** Filtra por viewport y ordena por "importancia" = intensidad × radio. */
  #collectVisible(camX, camY) {
    const out = [];
    const x0 = camX, y0 = camY, x1 = camX + this.viewW, y1 = camY + this.viewH;

    const consider = (l, intensity) => {
      if (intensity <= 0.002) return;
      if (l.x + l.radius < x0 || l.x - l.radius > x1) return;
      if (l.y + l.radius < y0 || l.y - l.radius > y1) return;
      out.push({ x: l.x, y: l.y, radius: l.radius, intensity, tint: l.tint, castsShadows: l.castsShadows });
    };

    for (const l of this.frameLights) consider(l, l.intensity);
    for (const l of this.timedLights) {
      // Los destellos caen rápido y sin rebote: un fogonazo no se "apaga
      // suavemente", desaparece. La curva cuadrática lo hace violento.
      const k = l.life / l.maxLife;
      consider(l, l.intensity * k * k);
    }

    out.sort((a, b) => (b.intensity * b.radius) - (a.intensity * a.radius));
    if (out.length > Config.lighting.maxLights) out.length = Config.lighting.maxLights;
    return out;
  }

  #drawLight(ctx, l, withShadows) {
    const { x, y, radius, intensity, tint } = l;
    // Red de seguridad: un solo NaN aquí lanza en createRadialGradient y se
    // lleva por delante el bucle entero. Una luz perdida no se echa de menos;
    // un juego congelado en mitad de una prueba, sí.
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(radius > 0)) return;

    // Curva de caída: alfa = 1 - e^(-intensidad · perfil).
    //
    // La primera versión recortaba la intensidad a 1 y el resultado era un
    // foco plano: media habitación al 100 % de alfa, sin degradado y sin
    // color — parecía "encender la luz", no un fogonazo. Con la exponencial
    // ninguna luz llega a saturar del todo, así que SIEMPRE queda gradiente y
    // el tinte se ve; subir la intensidad ensancha el alcance en vez de
    // aplanar la imagen. Es la diferencia entre iluminar y revelar.
    const f = clamp(Config.lighting.falloff, 0.1, 0.95);
    const a = (profile) => 1 - Math.exp(-intensity * profile);

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, rgba(tint, a(1)));
    grad.addColorStop(f * 0.22, rgba(tint, a(0.62)));
    grad.addColorStop(f, rgba(tint, a(0.24)));
    grad.addColorStop(f + (1 - f) * 0.55, rgba(tint, a(0.07)));
    grad.addColorStop(1, rgba(tint, 0));

    ctx.save();
    if (withShadows) {
      const poly = this.#visibility(x, y, radius);
      if (poly.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
        ctx.closePath();
        ctx.clip();
      }
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  /**
   * Polígono de visibilidad desde (lx,ly) limitado a `radius`.
   *
   * Se lanzan tres rayos por esquina (justo antes, justo en, justo después):
   * el rayo central toca la esquina y los laterales se cuelan por detrás, que
   * es lo que hace que la luz DOBLE la esquina en vez de cortarse en seco.
   */
  #visibility(lx, ly, radius) {
    const segs = this._segs;
    segs.length = 0;
    const x0 = lx - radius, x1 = lx + radius, y0 = ly - radius, y1 = ly + radius;
    for (const s of this.level.segments) {
      if (s.maxX < x0 || s.minX > x1 || s.maxY < y0 || s.minY > y1) continue;
      segs.push(s);
    }

    const angles = this._angles;
    angles.length = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const a1 = Math.atan2(s.ay - ly, s.ax - lx);
      const a2 = Math.atan2(s.by - ly, s.bx - lx);
      angles.push(a1 - CORNER_EPS, a1, a1 + CORNER_EPS);
      angles.push(a2 - CORNER_EPS, a2, a2 + CORNER_EPS);
    }
    for (let i = 0; i < FILLER_RAYS; i++) {
      angles.push((i / FILLER_RAYS) * TAU - Math.PI);
    }

    const poly = this._poly;
    poly.length = 0;
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      const dx = Math.cos(a), dy = Math.sin(a);
      let t = radius;
      for (let j = 0; j < segs.length; j++) {
        const s = segs[j];
        const h = raySegment(lx, ly, dx, dy, s.ax, s.ay, s.bx, s.by);
        if (h < t) t = h;
      }
      poly.push({ a, x: lx + dx * t, y: ly + dy * t });
    }
    poly.sort((p, q) => p.a - q.a);
    return poly;
  }

  /**
   * MEMORIA VISUAL.
   *
   * memMask = max(memMask · decaimiento, liveMask)
   *
   * `lighten` es max por canal, así que un mismo sitio iluminado dos veces no
   * se sobreexpone: simplemente reinicia su recuerdo.
   */
  #updateMemory(camX, camY, dt) {
    const mem = this.memCtx;
    mem.setTransform(1, 0, 0, 1, 0, 0);

    if (!Config.memory.enabled) {
      mem.clearRect(0, 0, this.memMask.width, this.memMask.height);
      return;
    }

    // Caída exponencial por vida media + una pizca lineal que empuja los
    // restos hasta cero. Sin ella quedan halos tenues que no mueren nunca.
    const decay = Math.exp((-Math.LN2 * dt) / Math.max(0.016, Config.memory.halfLife));
    const bite = clamp((1 - decay) + Config.memory.floor * dt, 0, 1);
    mem.globalCompositeOperation = 'destination-out';
    mem.fillStyle = `rgba(0,0,0,${bite})`;
    mem.fillRect(0, 0, this.memMask.width, this.memMask.height);

    // El recuerdo se ENFRÍA con la edad.
    //
    // `source-atop` respeta el alfa y solo empuja el color, así que cada
    // fotograma acerca un poco el recuerdo al tinte frío. El efecto compuesto
    // es exactamente lo que buscábamos: lo recién iluminado conserva su color
    // real y lo viejo se convierte en una silueta azulada. No es un filtro
    // sobre la imagen — es que el recuerdo pierde el color antes que la forma,
    // como la memoria de verdad.
    if (Config.memory.coolRate > 0) {
      mem.globalCompositeOperation = 'source-atop';
      mem.fillStyle = rgba(Config.memory.tint, clamp(Config.memory.coolRate * dt, 0, 1));
      mem.fillRect(0, 0, this.memMask.width, this.memMask.height);
    }

    // La luz viva entra en el recuerdo en su posición de MUNDO, DESPUÉS de
    // enfriar: lo que acaba de iluminarse no debe salir ya descolorido.
    mem.globalCompositeOperation = 'lighten';
    mem.drawImage(this.liveMask, Math.round(camX * this.scale), Math.round(camY * this.scale));
    mem.globalCompositeOperation = 'source-over';
  }

  /** combinedMask = max(ambiente, luz viva, memoria·fuerza). Solo geometría. */
  #buildCombined(camX, camY) {
    const ctx = this.combinedCtx;
    const w = this.combinedMask.width, h = this.combinedMask.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Suelo ambiental: la única información permanente del escenario.
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = rgba(Config.world.ambientTint, Config.world.ambient);
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighten';
    if (Config.memory.enabled && Config.memory.strength > 0) {
      ctx.globalAlpha = Config.memory.strength;
      ctx.drawImage(this.memMask, -Math.round(camX * this.scale), -Math.round(camY * this.scale));
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(this.liveMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
}
