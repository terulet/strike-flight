/**
 * Renderer — Canvas2D. Background and labels live in screen space (a distant city
 * should not zoom when the camera goes macro); the platform, the object and the
 * particles live in world space so a 0.2 mm gap can be rendered at 40 px wide.
 */
import { drawObjectShape, shade, rgba, roundRect } from './shapes.js';
import { PHASE } from '../physics/Simulation.js';
import { clamp, clamp01, lerp } from '../core/math.js';
import { toMm, formatMm } from '../ui/format.js';

const SKYLINE_SEED = 1337;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.w = 1; this.h = 1;
    this.skyline = buildSkyline();
    this.quality = 1;
  }

  resize(cssW, cssH, dpr) {
    this.w = cssW; this.h = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  draw(scene) {
    const ctx = this.ctx;
    const cam = scene.camera;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    this._sky(ctx, scene);
    this._skyline(ctx, scene);

    this._abyss(ctx, scene);

    cam.applyTo(ctx, this.dpr);
    // A tilted platform must LOOK tilted: the mutator is only fair if you can see it.
    const slope = scene.challenge.setup.slope || 0;
    if (slope) {
      ctx.translate(scene.challenge.platform.edgeX, 0);
      ctx.rotate(-slope);
      ctx.translate(-scene.challenge.platform.edgeX, 0);
    }
    this._platform(ctx, scene);
    this._ghosts(ctx, scene);
    this._object(ctx, scene);
    this._particles(ctx, scene);
    if (scene.debug && scene.debug.draw) this._debugWorld(ctx, scene);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._ruler(ctx, scene);
    this._labels(ctx, scene);
    this._wind(ctx, scene);
    this._loupe(ctx, scene);
    this._vignette(ctx, scene);
  }

  // ------------------------------------------------------------- BACKGROUND
  _sky(ctx, scene) {
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    if (scene.highContrast) {
      g.addColorStop(0, '#000308');
      g.addColorStop(0.45, '#03060c');
      g.addColorStop(1, '#000000');
    } else {
      g.addColorStop(0, '#05070d');
      g.addColorStop(0.34, '#0a1020');
      g.addColorStop(0.52, '#0d1526');
      g.addColorStop(0.74, '#070a12');
      g.addColorStop(1, '#030407');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    // A cold halo behind the action keeps the object readable at every zoom.
    const cam = scene.camera;
    const hx = cam.sx(scene.challenge.platform.edgeX);
    const hy = cam.sy(0);
    const r = Math.max(this.w, this.h) * 0.55;
    const halo = ctx.createRadialGradient(clamp(hx, -r, this.w + r), clamp(hy, -r, this.h + r), 0, hx, hy, r);
    halo.addColorStop(0, 'rgba(56,232,255,0.10)');
    halo.addColorStop(0.5, 'rgba(56,232,255,0.03)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  _skyline(ctx, scene) {
    if (scene.reduceFx) return;
    const cam = scene.camera;
    const horizon = this.h * 0.46;
    // Parallax is tiny on purpose: the city is kilometres away, so macro zoom
    // barely moves it. That contrast is what sells the height.
    const px = -cam.cx * 26 + this.w * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (let layer = 0; layer < 2; layer++) {
      const f = layer === 0 ? 0.55 : 1;
      const off = px * (layer === 0 ? 0.6 : 1);
      ctx.fillStyle = layer === 0 ? '#0c1424' : '#111c31';
      for (const b of this.skyline) {
        const bw = b.w * this.w * 0.13 * f;
        const bh = b.h * this.h * 0.16 * f;
        const bx = (off + b.x * this.w * 1.5) % (this.w * 1.6) - this.w * 0.3;
        ctx.fillRect(bx, horizon - bh, bw, bh + 4);
        if (layer === 1 && b.lit) {
          ctx.fillStyle = 'rgba(150,205,255,0.22)';
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(bx + bw * 0.22, horizon - bh + 8 + i * 13, bw * 0.16, 3);
            ctx.fillRect(bx + bw * 0.58, horizon - bh + 14 + i * 13, bw * 0.14, 3);
          }
          ctx.fillStyle = '#111c31';
        }
      }
    }
    ctx.restore();
    const fog = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 120);
    fog.addColorStop(0, 'rgba(10,16,32,0)');
    fog.addColorStop(0.5, 'rgba(8,12,24,0.75)');
    fog.addColorStop(1, 'rgba(3,5,10,0.98)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 60, this.w, 200);
  }

  /**
   * The void. Screen space on purpose: the drop is supposed to be enormous, so it
   * must not shrink when the camera zooms into the last millimetre.
   */
  _abyss(ctx, scene) {
    const cam = scene.camera;
    const top = cam.sy(0);
    if (top > this.h) return;
    const depth = this.h - top;
    const g = ctx.createLinearGradient(0, top, 0, this.h);
    g.addColorStop(0, 'rgba(3,5,10,0.35)');
    g.addColorStop(0.25, 'rgba(2,3,7,0.80)');
    g.addColorStop(1, 'rgba(0,0,0,0.98)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, this.w, depth + 2);

    if (scene.reduceFx) return;
    // Cloud decks far below — the only thing between the object and the ground.
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = top + depth * (0.22 + i * 0.24) + Math.sin(cam.cx * 3 + i) * 4;
      const hgt = 26 + i * 16;
      const gg = ctx.createLinearGradient(0, y - hgt, 0, y + hgt);
      gg.addColorStop(0, 'rgba(80,120,180,0)');
      gg.addColorStop(0.5, `rgba(70,110,170,${0.05 - i * 0.012})`);
      gg.addColorStop(1, 'rgba(80,120,180,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, y - hgt, this.w, hgt * 2);
    }
    ctx.restore();
  }

  // --------------------------------------------------------------- PLATFORM
  _platform(ctx, scene) {
    const { challenge, camera } = scene;
    const p = challenge.platform;
    const s = challenge.surface;
    const px = 1 / camera.pxPerM; // one screen pixel in world units
    const th = p.thickness;
    const x0 = p.startX - 0.25;
    const x1 = p.edgeX;

    // Slab body
    const g = ctx.createLinearGradient(0, 0, 0, -th);
    g.addColorStop(0, s.color);
    g.addColorStop(0.25, shade(s.color, -0.25));
    g.addColorStop(1, shade(s.color, -0.62));
    ctx.fillStyle = g;
    ctx.fillRect(x0, -th, x1 - x0, th);

    // Under-shadow so the slab reads as a solid block hanging in the void
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x0, -th - th * 0.22, x1 - x0, th * 0.22);

    // Structure falling away into the dark — cheap, and it sells the height.
    if (!scene.reduceFx) {
      const drop = camera.spanY * 0.42;
      const mass = ctx.createLinearGradient(0, -th, 0, -th - drop);
      mass.addColorStop(0, 'rgba(0,0,0,0.72)');
      mass.addColorStop(0.35, 'rgba(0,0,0,0.34)');
      mass.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mass;
      ctx.beginPath();
      ctx.moveTo(x0, -th);
      ctx.lineTo(x1, -th);
      ctx.lineTo(x1 - drop * 0.28, -th - drop);
      ctx.lineTo(x0 + drop * 0.18, -th - drop);
      ctx.closePath();
      ctx.fill();
      const beam = ctx.createLinearGradient(0, -th, 0, -th - drop * 0.8);
      beam.addColorStop(0, shade(s.color, -0.7));
      beam.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beam;
      for (let i = 0; i < 3; i++) {
        const sxp = x1 - 0.05 - i * 0.19;
        if (sxp < x0) break;
        ctx.fillRect(sxp, -th - drop * 0.8, th * 0.20, drop * 0.8);
      }
    }

    // Top face
    const tg = ctx.createLinearGradient(0, 0, 0, -th * 0.42);
    tg.addColorStop(0, s.colorTop);
    tg.addColorStop(1, shade(s.colorTop, -0.32));
    ctx.fillStyle = tg;
    ctx.fillRect(x0, -th * 0.42, x1 - x0, th * 0.42);

    // Grain / texture — deterministic, spaced in world units so it survives zoom
    if (!scene.reduceFx) {
      ctx.save();
      ctx.strokeStyle = rgba(s.grain, s.id === 'ice' ? 0.35 : 0.5);
      ctx.lineWidth = Math.max(px, 0.0006);
      const step = s.id === 'sand' ? 0.008 : 0.022;
      ctx.beginPath();
      const start = Math.ceil(x0 / step) * step;
      for (let x = start; x < x1; x += step) {
        const jitter = ((Math.sin(x * 813.7) + 1) / 2) * th * 0.18;
        ctx.moveTo(x, -th * 0.40 + jitter);
        ctx.lineTo(x, -th * 0.06 - jitter);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Launch marker: where the object starts, so the player can read the distance
    const sx = challenge.setup.startX;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(sx - challenge.object.width * 0.5 - 0.004, -th * 0.42, 0.003, th * 0.42);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x0, -th * 0.42, sx - challenge.object.width * 0.5 - x0, th * 0.42);

    // THE EDGE — the most important 2 pixels in the game
    const glow = ctx.createLinearGradient(x1 - 0.03, 0, x1, 0);
    glow.addColorStop(0, rgba(s.accent, 0));
    glow.addColorStop(1, rgba(s.accent, 0.55));
    ctx.fillStyle = glow;
    ctx.fillRect(x1 - 0.03, -th * 0.42, 0.03, th * 0.42);
    ctx.fillStyle = scene.highContrast ? '#ffffff' : shade(s.accent, 0.35);
    ctx.fillRect(x1 - Math.max(px * 1.5, 0.0004), -th, Math.max(px * 1.5, 0.0004), th);

    // A hint of the drop: the slab's far face catching light
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x1 - 0.002, -th, 0.002, th);
  }

  // ----------------------------------------------------------------- GHOSTS
  _ghosts(ctx, scene) {
    const cam = scene.camera;
    const px = 1 / cam.pxPerM;
    const th = scene.challenge.platform.thickness;
    for (const g of scene.ghosts || []) {
      if (!Number.isFinite(g.x)) continue;
      ctx.save();
      ctx.globalAlpha = g.alpha ?? 0.85;
      // Vertical marker at their balance point
      ctx.strokeStyle = g.color;
      ctx.lineWidth = Math.max(px * 1.5, 0.0004);
      ctx.setLineDash([px * 5, px * 5]);
      ctx.beginPath();
      ctx.moveTo(g.x, -th);
      ctx.lineTo(g.x, cam.spanY * 0.34);
      ctx.stroke();
      ctx.setLineDash([]);
      // Their object, resting where they left it. Past a certain zoom it stops being
      // a silhouette and becomes a coloured blob, so it bows out.
      const ghostReadable = g.object && g.object.width * cam.pxPerM < this.w * 0.5;
      if (g.object && ghostReadable && !scene.reduceFx) {
        ctx.save();
        ctx.translate(g.x - g.object.comOffset, 0);
        ctx.globalAlpha = (g.alpha ?? 0.85) * 0.16;
        drawObjectShape(ctx, g.object, {
          ghost: true, color: g.color, outline: px * 1.6, outlineColor: g.color,
        });
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------- OBJECT
  _object(ctx, scene) {
    const { state, challenge, camera } = scene;
    if (!state) return;
    const obj = challenge.object;
    const th = challenge.platform.thickness;
    const px = 1 / camera.pxPerM;

    // Contact shadow — shrinks as the object hangs over nothing
    const supported = clamp01((challenge.platform.edgeX - (state.x - obj.width / 2)) / obj.width);
    if (state.phase !== PHASE.FALLING && supported > 0) {
      ctx.save();
      ctx.globalAlpha = 0.42 * supported;
      const sg = ctx.createLinearGradient(state.x - obj.width * 0.6, 0, state.x + obj.width * 0.6, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.5, 'rgba(0,0,0,0.85)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      // Sits right at the contact surface and shrinks with the supported area.
      ctx.fillRect(state.x - obj.width * 0.6, 0, obj.width * 1.2 * supported, -th * 0.26);
      ctx.restore();
    }

    // Motion trail — fades away behind the object, never a solid bar
    const trail = scene.trail;
    if (trail && trail.length > 3 && !scene.reduceFx && state.v > 0.06) {
      const x0 = trail[0];
      const x1 = trail[trail.length - 1];
      if (Math.abs(x1 - x0) > obj.width * 0.15) {
        ctx.save();
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, rgba(obj.accent, 0));
        g.addColorStop(1, rgba(obj.accent, 0.30));
        ctx.strokeStyle = g;
        ctx.lineWidth = obj.height * 0.16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, obj.height * 0.42);
        ctx.lineTo(x1, obj.height * 0.42);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    if (state.phase === PHASE.TIPPING) {
      // Pivot about the platform edge, exactly where the physics pivots.
      ctx.translate(challenge.platform.edgeX, 0);
      ctx.rotate(-state.angle);
      ctx.translate(-challenge.platform.edgeX, 0);
      ctx.translate(state.x, 0);
    } else if (state.phase === PHASE.FALLING || state.phase === PHASE.FALLEN) {
      ctx.translate(state.x, -state.y);
      ctx.rotate(-state.angle);
    } else {
      ctx.translate(state.x, 0);
    }
    const squash = scene.squash || null;
    drawObjectShape(ctx, obj, { squash, outline: px * 1.2 });
    // Balance point marker — subtle, but it explains the whole scoring rule
    if (scene.showCom) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(obj.comOffset, obj.height * 0.5, px * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _particles(ctx, scene) {
    const ps = scene.particles;
    if (!ps || !ps.count) return;
    const px = 1 / scene.camera.pxPerM;
    for (let i = 0; i < ps.max; i++) {
      const p = ps.pool[i];
      if (!p.active) continue;
      const a = clamp01(p.life / p.max);
      ctx.globalAlpha = a * (p.type === 'mote' ? 0.4 : 0.9);
      ctx.fillStyle = p.color;
      const s = Math.max(p.size * (0.4 + a * 0.6), px);
      if (p.type === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-s, -s * 0.32, s * 2, s * 0.64);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ RULER
  /** A measuring rule that appears only when the zoom makes it meaningful. */
  _ruler(ctx, scene) {
    const cam = scene.camera;
    const edgeX = scene.challenge.platform.edgeX;
    const mmPerPx = 1000 / cam.pxPerM;
    if (mmPerPx > 0.9) return; // too coarse to be worth drawing
    const steps = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25];
    let step = steps[steps.length - 1];
    for (const s of steps) { if (s / mmPerPx >= 26) { step = s; break; } }

    const yTop = cam.sy(0);
    const ex = cam.sx(edgeX);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.font = '600 9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 14; i++) {
      const mm = i * step;
      const x = ex - (mm / 1000) * cam.pxPerM;
      if (x < -20) break;
      const big = i % 5 === 0;
      ctx.globalAlpha = big ? 0.85 : 0.4;
      ctx.beginPath();
      ctx.moveTo(x, yTop - 2);
      ctx.lineTo(x, yTop - (big ? 16 : 9));
      ctx.stroke();
      if (big && i > 0) ctx.fillText(formatMm(mm), x, yTop - 21);
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------- LABELS
  _labels(ctx, scene) {
    const cam = scene.camera;
    ctx.save();
    ctx.font = '900 10px -apple-system, system-ui, sans-serif';
    const loupeOn = scene.magnifier && scene.magnifier.alpha > 0.05;
    const labelBase = Math.min(cam.sy(0) - 46, this.h * (loupeOn ? 0.46 : 0.30));
    let slot = 0;
    for (const g of scene.ghosts || []) {
      if (!g.label || !Number.isFinite(g.x)) continue;
      const x = clamp(cam.sx(g.x), 44, this.w - 44);
      const y = clamp(labelBase - slot * 26, 30, this.h - 40);
      slot++;
      const text = g.label;
      ctx.textAlign = 'center';
      const wpx = ctx.measureText(text).width + 16;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(8,10,14,0.82)';
      roundRect(ctx, x - wpx / 2, y - 13, wpx, 19, 9);
      ctx.fill();
      ctx.strokeStyle = rgba(g.color, 0.5);
      ctx.lineWidth = 1;
      roundRect(ctx, x - wpx / 2, y - 13, wpx, 19, 9);
      ctx.stroke();
      ctx.fillStyle = g.color;
      ctx.fillText(text, x, y + 1);
      // tail down to the marker
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y + 7);
      ctx.lineTo(x, Math.max(y + 7, cam.sy(0) - 4));
      ctx.strokeStyle = g.color;
      ctx.stroke();
    }
    ctx.restore();

  }

  /**
   * The loupe: a macro inset that proves the number. At these scales the world is
   * just two straight edges and a gap, so it is drawn directly rather than by
   * re-running the scene through a second camera.
   */
  _loupe(ctx, scene) {
    const m = scene.magnifier;
    if (!m || (!m.on && m.alpha <= 0.01)) return;
    const alpha = m.alpha;
    const W = Math.min(this.w - 44, 300);
    const H = 118;
    const x = (this.w - W) / 2;
    const y = Math.max(this.h * 0.11, 78);
    const edgeX = scene.challenge.platform.edgeX;
    const gap = Math.max(edgeX - m.comX, 1e-7);
    const span = Math.max(gap * 4.6, 0.00035);
    const scale = W / span;
    const cx = (m.comX + edgeX) / 2;
    const sx = (wx) => x + W / 2 + (wx - cx) * scale;
    const surfaceY = y + H * 0.58;

    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(ctx, x, y, W, H, 16);
    ctx.save();
    ctx.clip();
    // sky / void
    ctx.fillStyle = '#05070d';
    ctx.fillRect(x, y, W, H);
    // the slab, seen from a few hundred microns away
    ctx.fillStyle = shade(scene.challenge.surface.color, -0.15);
    ctx.fillRect(x, surfaceY, Math.min(sx(edgeX), x + W) - x, H);
    ctx.fillStyle = rgba(scene.challenge.surface.accent, 0.5);
    ctx.fillRect(x, surfaceY, Math.min(sx(edgeX), x + W) - x, 2);
    // the object's underside, hanging out over nothing
    const frontPx = Number.isFinite(m.frontX) ? sx(m.frontX) : x + W;
    ctx.fillStyle = shade(scene.challenge.object.color, 0.18);
    ctx.fillRect(x, y, Math.min(frontPx, x + W) - x, surfaceY - y - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, surfaceY - 3, Math.min(frontPx, x + W) - x, 3);
    ctx.restore();

    // the two lines that decide everything
    const comPx = sx(m.comX);
    const edgePx = sx(edgeX);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(comPx, y + 4); ctx.lineTo(comPx, y + H - 4); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(edgePx, y + 4); ctx.lineTo(edgePx, y + H - 4); ctx.stroke();

    // measurement
    const my = y + H - 26;
    ctx.strokeStyle = '#ff2fd0';
    ctx.fillStyle = '#ff2fd0';
    ctx.beginPath();
    ctx.moveTo(comPx, my); ctx.lineTo(edgePx, my);
    ctx.moveTo(comPx, my - 5); ctx.lineTo(comPx, my + 5);
    ctx.moveTo(edgePx, my - 5); ctx.lineTo(edgePx, my + 5);
    ctx.stroke();
    ctx.font = '900 13px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    const text = `${formatMm(m.mm)} mm`;
    const tw = ctx.measureText(text).width + 14;
    const mx = clamp((comPx + edgePx) / 2, x + tw / 2 + 4, x + W - tw / 2 - 4);
    ctx.fillStyle = 'rgba(6,8,12,0.92)';
    roundRect(ctx, mx - tw / 2, my - 34, tw, 21, 8); ctx.fill();
    ctx.fillStyle = '#ff2fd0';
    ctx.fillText(text, mx, my - 19);

    // frame + caption
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, W, H, 16); ctx.stroke();
    ctx.font = '800 8px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'left';
    ctx.fillText('MACRO', x + 12, y + 16);
    ctx.textAlign = 'right';
    ctx.fillText(`${(span * 1000).toFixed(2)} mm ACROSS`, x + W - 12, y + 16);
    ctx.restore();
  }

  /** Wind is only fair if you can see it: faint streaks blowing against the shot. */
  _wind(ctx, scene) {
    const w = scene.challenge.setup.wind || 0;
    if (!w || scene.reduceFx) return;
    const cam = scene.camera;
    const top = cam.sy(0);
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 1;
    const dir = Math.sign(w);
    const t = (scene.time || 0) * 0.7;
    for (let i = 0; i < 7; i++) {
      const y = top - 30 - ((i * 37 + (t * 90) % 260)) % 260;
      const len = 26 + (i % 3) * 16;
      const x = ((i * 91 + t * 260 * -dir) % (this.w + 160)) - 80;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * dir, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _vignette(ctx, scene) {
    if (scene.reduceFx) return;
    const g = ctx.createRadialGradient(this.w * 0.5, this.h * 0.5, this.h * 0.28, this.w * 0.5, this.h * 0.5, this.h * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ------------------------------------------------------------ DEBUG WORLD
  _debugWorld(ctx, scene) {
    const { state, challenge, camera } = scene;
    const obj = challenge.object;
    const px = 1 / camera.pxPerM;
    const th = challenge.platform.thickness;
    ctx.save();
    ctx.lineWidth = Math.max(px, 0.0002);
    // bounding box
    ctx.strokeStyle = 'rgba(157,255,176,0.9)';
    ctx.strokeRect(state.x - obj.width / 2, 0, obj.width, obj.height);
    // support area (what is still on the slab)
    const supEnd = Math.min(state.x + obj.width / 2, challenge.platform.edgeX);
    ctx.fillStyle = 'rgba(90,200,255,0.25)';
    ctx.fillRect(state.x - obj.width / 2, -th * 0.42, Math.max(0, supEnd - (state.x - obj.width / 2)), th * 0.42);
    // centre of mass
    ctx.fillStyle = '#ff2fd0';
    ctx.beginPath();
    ctx.arc(state.x + obj.comOffset, obj.height * 0.5, Math.max(px * 3, obj.height * 0.1), 0, Math.PI * 2);
    ctx.fill();
    // edge line
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(challenge.platform.edgeX, -th * 1.5);
    ctx.lineTo(challenge.platform.edgeX, obj.height * 4);
    ctx.stroke();
    // velocity vector
    if (state.v > 0) {
      ctx.strokeStyle = '#9dffb0';
      ctx.beginPath();
      ctx.moveTo(state.x, obj.height * 1.6);
      ctx.lineTo(state.x + state.v * 0.06, obj.height * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function buildSkyline() {
  // Deterministic, cheap, and stable across reloads.
  let seed = SKYLINE_SEED;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out = [];
  let x = 0;
  while (x < 1.4) {
    const w = 0.25 + rnd() * 0.7;
    out.push({ x, w, h: 0.28 + rnd() * 1.5, lit: rnd() > 0.55 });
    x += w * 0.16 + 0.012;
  }
  return out;
}
