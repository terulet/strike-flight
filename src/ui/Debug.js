/**
 * DEBUG — ver lo que el juego esconde, y poder cambiarlo sin recompilar.
 *
 * Dos mitades:
 *
 *   superposición   dibuja sobre el mundo lo que el jugador NO ve: estados
 *                   de la IA, conos de visión, radios de escucha, última
 *                   posición conocida, ruidos emitidos, luces activas.
 *   panel (F2)      deslizadores en vivo sobre Config. Balancear la
 *                   iluminación mirando el resultado en tiempo real es la
 *                   diferencia entre ajustar el juego en una tarde o en una
 *                   semana. Por eso es DOM y no lienzo: quiero un input
 *                   range de verdad, y que funcione con el dedo.
 */

import { Config, Defaults, getPath, setPath } from '../config/Config.js';
import { State } from '../entities/EnemyAI.js';
import { TAU } from '../core/MathUtils.js';

/** Parámetros expuestos en el panel: [ruta, mínimo, máximo, paso]. */
const TUNABLES = [
  ['— OSCURIDAD —'],
  ['world.ambient', 0, 0.3, 0.005],
  ['lighting.bloom', 0, 1, 0.02],
  ['lighting.maskScale', 0.25, 1, 0.05],
  ['lighting.falloff', 0.1, 0.95, 0.05],
  ['render.vignette', 0, 1, 0.05],
  ['— MEMORIA VISUAL —'],
  ['memory.halfLife', 0.05, 3, 0.05],
  ['memory.strength', 0, 1, 0.02],
  ['memory.floor', 0, 0.4, 0.01],
  ['memory.coolRate', 0, 8, 0.1],
  ['— FOGONAZO —'],
  ['lighting.muzzle.radius', 60, 900, 10],
  ['lighting.muzzle.intensity', 0.2, 4, 0.1],
  ['lighting.muzzle.duration', 0.02, 0.5, 0.005],
  ['— PROYECTIL —'],
  ['lighting.projectile.radius', 30, 500, 10],
  ['lighting.projectile.intensity', 0.1, 3, 0.05],
  ['weapon.projectileSpeed', 200, 2400, 25],
  ['— IMPACTO —'],
  ['lighting.impact.radius', 40, 800, 10],
  ['lighting.impact.intensity', 0.2, 4, 0.1],
  ['lighting.impact.duration', 0.02, 0.6, 0.01],
  ['— ARMA —'],
  ['weapon.fireInterval', 0.05, 0.8, 0.005],
  ['weapon.magSize', 1, 30, 1],
  ['weapon.shotLoudness', 100, 2000, 25],
  ['weapon.hitStopMs', 0, 150, 2],
  ['camera.shakeMaxOffset', 0, 60, 1],
  ['— ENEMIGO —'],
  ['enemy.visionRange', 60, 700, 10],
  ['enemy.visionRangeDark', 20, 400, 5],
  ['enemy.hearingRange', 100, 1600, 25],
  ['enemy.hearingError', 0, 300, 5],
  ['enemy.speedAlert', 40, 300, 5],
  ['enemy.attackInterval', 0.3, 4, 0.05],
  ['— JUGADOR —'],
  ['player.maxSpeed', 60, 420, 5],
  ['player.exposureDecay', 0.2, 8, 0.1],
  ['player.auraRadius', 0, 220, 5],
];

export class Debug {
  constructor(game) {
    this.game = game;
    this.panel = null;
    this.panelOpen = false;
  }

  togglePanel() {
    if (!this.panel) this.#buildPanel();
    this.panelOpen = !this.panelOpen;
    this.panel.style.display = this.panelOpen ? 'block' : 'none';
    if (this.panelOpen) Config.debug.enabled = true;
  }

  /* ────────────────────── superposición sobre el mundo ─────────────── */

  render(ctx, W, H) {
    const g = this.game;
    const cam = g.camera;
    const D = Config.debug;

    ctx.save();
    ctx.font = '500 10px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    if (D.showHearing) {
      for (const s of g.soundEvents) {
        const k = s.life / s.maxLife;
        const r = Math.min(s.r, Config.enemy.hearingRange) * (1 - k);
        ctx.strokeStyle = `rgba(255,220,120,${k * 0.5})`;
        ctx.beginPath();
        ctx.arc(s.x - cam.x, s.y - cam.y, r, 0, TAU);
        ctx.stroke();
      }
    }

    if (D.showLights) {
      ctx.strokeStyle = 'rgba(120,220,255,0.35)';
      for (const l of [...g.lighting.frameLights, ...g.lighting.timedLights]) {
        ctx.beginPath();
        ctx.arc(l.x - cam.x, l.y - cam.y, l.radius, 0, TAU);
        ctx.stroke();
      }
    }

    for (const e of g.enemies) {
      if (!e.alive) continue;
      const sx = e.x - cam.x, sy = e.y - cam.y;
      const col = e.ai.debugColor;

      if (D.showVision) {
        const E = Config.enemy;
        const range = E.visionRangeDark + (E.visionRange - E.visionRangeDark) * g.player.exposure;
        ctx.fillStyle = col.replace(')', ',0.07)').replace('#', 'rgba(') === col
          ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, range, e.dir - E.visionFov / 2, e.dir + E.visionFov / 2);
        ctx.closePath();
        ctx.fill();
      }

      if (D.showHearing) {
        ctx.strokeStyle = 'rgba(255,220,120,0.14)';
        ctx.beginPath();
        ctx.arc(sx, sy, Config.enemy.hearingRange, 0, TAU);
        ctx.stroke();
      }

      if (D.showAI) {
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.fillText(e.ai.state, sx, sy - 22);

        // Objetivo actual y última posición conocida del jugador.
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(e.ai.targetX - cam.x, e.ai.targetY - cam.y);
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (e.ai.hasLastKnown) {
          const lx = e.ai.lastKnownX - cam.x, ly = e.ai.lastKnownY - cam.y;
          ctx.strokeStyle = 'rgba(255,90,90,0.7)';
          ctx.beginPath();
          ctx.moveTo(lx - 5, ly - 5); ctx.lineTo(lx + 5, ly + 5);
          ctx.moveTo(lx + 5, ly - 5); ctx.lineTo(lx - 5, ly + 5);
          ctx.stroke();
        }
      }
    }

    if (D.showColliders) {
      ctx.strokeStyle = 'rgba(0,255,180,0.5)';
      ctx.beginPath();
      ctx.arc(g.player.x - cam.x, g.player.y - cam.y, Config.player.radius, 0, TAU);
      ctx.stroke();
    }

    this.#stats(ctx, W, H);
    ctx.restore();
  }

  #stats(ctx, W, H) {
    const g = this.game;
    const p = g.player;
    const states = { IDLE: 0, SUSPICIOUS: 0, ALERT: 0, LOST: 0 };
    let alive = 0;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      alive++;
      states[e.ai.state]++;
    }

    const lines = [
      `fps ${g.fps.toFixed(0)}   frame ${g.frameMs.toFixed(1)}ms   ${g.renderer.viewW}x${g.renderer.viewH}@${g.renderer.dpr.toFixed(2)}`,
      `  lógica ${g.perf.update.toFixed(1)}  escenario ${g.perf.static.toFixed(1)}  entidades ${g.perf.entities.toFixed(1)}  luz ${g.perf.light.toFixed(1)}  composición ${g.perf.compose.toFixed(1)}  (ms)`,
      `jugador  ${p.x.toFixed(0)}, ${p.y.toFixed(0)}   vel ${Math.hypot(p.vx, p.vy).toFixed(0)}`,
      `exposición ${p.exposure.toFixed(2)}   munición ${p.weapon.mag}/${p.weapon.reserve}   disp ${p.weapon.shotsFired}`,
      `enemigos ${alive}/${g.enemies.length}   ${State.IDLE} ${states.IDLE} · ${State.SUSPICIOUS} ${states.SUSPICIOUS} · ${State.ALERT} ${states.ALERT} · ${State.LOST} ${states.LOST}`,
      `proyectiles ${g.projectiles.count}   partículas ${g.effects.particles.active}`,
      `luces ${g.lighting.activeCount} (sombras ${g.lighting.shadowCount}/${Config.lighting.maxShadowCasters})   segmentos ${g.level.segments.length}`,
      `memoria ${Config.memory.enabled ? `t½ ${Config.memory.halfLife}s × ${Config.memory.strength}` : 'OFF'}   ambiente ${Config.world.ambient}`,
      `F1 debug · F2 parámetros`,
    ];

    ctx.textAlign = 'left';
    ctx.font = '500 11px ui-monospace, Menlo, monospace';
    const boxH = lines.length * 14 + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(10, H - boxH - 10, 430, boxH);
    ctx.fillStyle = '#7fe0b0';
    lines.forEach((l, i) => ctx.fillText(l, 20, H - boxH - 10 + 16 + i * 14));
  }

  /* ──────────────────────── panel de parámetros ────────────────────── */

  #buildPanel() {
    const el = document.createElement('div');
    el.id = 'll-debug-panel';
    el.innerHTML = `
      <div class="ll-dbg-head">
        <strong>LAST LIGHT · parámetros</strong>
        <div>
          <button data-act="reset">reset</button>
          <button data-act="copy">copiar</button>
          <button data-act="close">✕</button>
        </div>
      </div>
      <div class="ll-dbg-body"></div>`;
    document.body.appendChild(el);

    const body = el.querySelector('.ll-dbg-body');
    this.rows = [];

    for (const item of TUNABLES) {
      if (item.length === 1) {
        const h = document.createElement('div');
        h.className = 'll-dbg-sec';
        h.textContent = item[0];
        body.appendChild(h);
        continue;
      }
      const [path, min, max, step] = item;
      const row = document.createElement('label');
      row.className = 'll-dbg-row';
      const name = document.createElement('span');
      name.textContent = path.split('.').slice(-1)[0];
      name.title = path;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = step;
      input.value = getPath(Config, path);
      const val = document.createElement('em');
      val.textContent = (+input.value).toFixed(3).replace(/\.?0+$/, '');

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        setPath(Config, path, v);
        val.textContent = String(v);
        // maskScale cambia el tamaño de los lienzos: hay que rehacerlos.
        if (path === 'lighting.maskScale') this.#rebuildMasks();
      });

      row.append(name, input, val);
      body.appendChild(row);
      this.rows.push({ path, input, val });
    }

    el.querySelector('[data-act="close"]').onclick = () => this.togglePanel();
    el.querySelector('[data-act="reset"]').onclick = () => {
      for (const { path, input, val } of this.rows) {
        const v = getPath(Defaults, path);
        setPath(Config, path, v);
        input.value = v;
        val.textContent = String(v);
      }
      this.#rebuildMasks();
    };
    el.querySelector('[data-act="copy"]').onclick = () => {
      // Vuelca los valores actuales para pegarlos en Config.js sin transcribir.
      const out = this.rows.map(({ path }) => `${path}: ${getPath(Config, path)}`).join('\n');
      navigator.clipboard?.writeText(out);
      console.log('[LAST LIGHT] parámetros actuales\n' + out);
    };

    el.style.display = 'none';
    this.panel = el;
  }

  #rebuildMasks() {
    const g = this.game;
    g.lighting.scale = Config.lighting.maskScale;
    g.lighting.memMask.width = Math.ceil(g.level.width * g.lighting.scale);
    g.lighting.memMask.height = Math.ceil(g.level.height * g.lighting.scale);
    g.lighting.viewW = 0;   // fuerza el redimensionado en el próximo resize
    g.lighting.resize(g.renderer.viewW, g.renderer.viewH);
  }
}
