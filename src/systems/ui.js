/**
 * All UI is drawn on the canvas. Zero DOM nodes: nothing to reflow, nothing
 * to fight the safe area, and the whole interface scales with the viewport
 * for free.
 */
import { COLORS, VIEW } from '../config.js';
import { clamp, easeOutBack, easeOutCubic } from '../core/math.js';

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const DEATH_MESSAGES = {
  saw: 'SLICED',
  laser: 'VAPORIZED',
  crush: 'FLATTENED',
  spike: 'SKEWERED',
  fall: 'DROPPED',
  fire: 'TOASTED',
  shock: 'FRIED',
  enemy: 'BONKED',
  boss: 'SQUASHED',
};

export class UI {
  constructor(gfx, viewport) {
    this.gfx = gfx;
    this.vp = viewport;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
  }

  // ── in-run HUD ─────────────────────────────────────────────────────────
  drawHud(floor, best, { newRecord = false, pulse = 0 } = {}) {
    const g = this.gfx;
    const top = this.vp.hudTop;
    const scale = 1 + easeOutCubic(clamp(pulse, 0, 1)) * 0.22;

    g.text('FLOOR', VIEW.W / 2, top + 12, { size: 10, color: COLORS.textDim, letterSpacing: 3 });
    g.text(String(floor), VIEW.W / 2, top + 40, {
      size: 34 * scale, color: newRecord ? COLORS.gold : COLORS.text, weight: 800,
    });

    if (best > 0) {
      g.text(`BEST ${best}`, VIEW.W / 2, top + 62, { size: 10, color: COLORS.textDim, letterSpacing: 2 });
    }
  }

  /** Short, fading teaching prompt. */
  drawHint(hint, age, duration = 2.6) {
    if (!hint || age > duration) return;
    const g = this.gfx;
    const fadeIn = clamp(age / 0.25, 0, 1);
    const fadeOut = 1 - clamp((age - (duration - 0.5)) / 0.5, 0, 1);
    const a = fadeIn * fadeOut;
    const y = VIEW.H * 0.30;
    const w = Math.max(150, g.measure(hint.text, 13) + 46);
    g.roundRect(VIEW.W / 2 - w / 2, y - 17, w, 34, 17, '#0b1020', 0.82 * a);
    g.strokeRoundRect(VIEW.W / 2 - w / 2, y - 17, w, 34, 17, '#26314f', 1, a);
    this._icon(hint.icon, VIEW.W / 2 - w / 2 + 20, y, a);
    g.text(hint.text, VIEW.W / 2 + 12, y + 1, { size: 13, color: COLORS.text, letterSpacing: 1, alpha: a });
  }

  _icon(kind, x, y, a) {
    const g = this.gfx;
    const pulse = 0.5 + Math.sin(this.t * 6) * 0.5;
    if (kind === 'tap') {
      g.circle(x, y, 6 + pulse * 2, COLORS.player, 0.25 * a);
      g.circle(x, y, 4.5, COLORS.player, a);
    } else if (kind === 'hold') {
      g.circle(x, y, 4.5, COLORS.player, a);
      g.strokeRoundRect(x - 8, y - 8, 16, 16, 8, COLORS.player, 1.4, a * (0.35 + pulse * 0.45));
    } else if (kind === 'run') {
      for (let i = 0; i < 3; i++) g.rect(x - 8 + i * 6, y - 1 - i, 4, 2 + i, COLORS.player, a * (0.4 + i * 0.3));
    } else if (kind === 'danger') {
      g.ctx.fillStyle = COLORS.danger;
      g.ctx.globalAlpha = a;
      g.ctx.beginPath();
      g.ctx.moveTo(x, y - 7); g.ctx.lineTo(x + 7, y + 6); g.ctx.lineTo(x - 7, y + 6);
      g.ctx.closePath(); g.ctx.fill();
      g.ctx.globalAlpha = 1;
      g.text('!', x, y + 1, { size: 9, color: '#2a0710' });
    } else if (kind === 'eye') {
      g.circle(x, y, 6.5, COLORS.warn, a * 0.9);
      g.circle(x + 1.5, y, 2.6, '#1a1206', a);
    } else if (kind === 'boss') {
      g.roundRect(x - 7, y - 6, 14, 12, 4, COLORS.boss, a);
      g.circle(x, y, 3, '#0b0714', a);
    }
  }

  // ── title ──────────────────────────────────────────────────────────────
  drawTitle(best, age) {
    const g = this.gfx;
    const a = clamp(age / 0.4, 0, 1);
    // Scrim so the wordmark reads over whatever the room is doing behind it.
    g.rect(0, 0, VIEW.W, VIEW.H, '#05060c', 0.62 * a);
    const cy = VIEW.H * 0.34;
    const pop = easeOutBack(clamp(age / 0.55, 0, 1));

    g.text('ONE', VIEW.W / 2, cy - 42 * pop, { size: 46 * pop, color: COLORS.text, weight: 800, letterSpacing: 6, alpha: a });
    g.text('MORE', VIEW.W / 2, cy + 4 * pop, { size: 46 * pop, color: COLORS.player, weight: 800, letterSpacing: 6, alpha: a });
    g.text('FLOOR', VIEW.W / 2, cy + 50 * pop, { size: 46 * pop, color: COLORS.text, weight: 800, letterSpacing: 6, alpha: a });

    if (best > 0) {
      g.text(`BEST FLOOR  ${best}`, VIEW.W / 2, cy + 104, { size: 12, color: COLORS.gold, letterSpacing: 3, alpha: a });
    }

    const blink = 0.55 + Math.sin(this.t * 4) * 0.45;
    g.text('TAP TO CLIMB', VIEW.W / 2, VIEW.H * 0.7, {
      size: 15, color: COLORS.text, letterSpacing: 4, alpha: a * blink,
    });

    const y = VIEW.H * 0.79;
    this._legend(VIEW.W / 2, y, a * 0.85);
  }

  _legend(cx, y, a) {
    const g = this.gfx;
    const rows = [
      ['tap', 'TAP', 'JUMP'],
      ['hold', 'HOLD', 'STOP'],
      ['run', 'SWIPE DOWN', 'DIVE'],
    ];
    rows.forEach((r, i) => {
      const ry = y + i * 22;
      this._icon(r[0], cx - 86, ry, a);
      g.text(r[1], cx - 68, ry, { size: 11, color: COLORS.textDim, align: 'left', alpha: a, letterSpacing: 1 });
      g.text(r[2], cx + 86, ry, { size: 11, color: COLORS.text, align: 'right', alpha: a, letterSpacing: 1 });
    });
  }

  // ── result ─────────────────────────────────────────────────────────────
  drawResult(floor, best, isRecord, cause, age) {
    const g = this.gfx;
    const a = clamp(age / 0.18, 0, 1);
    const pop = easeOutBack(clamp(age / 0.4, 0, 1));
    g.rect(0, 0, VIEW.W, VIEW.H, '#05060c', 0.62 * a);

    const cy = VIEW.H * 0.38;
    const msg = DEATH_MESSAGES[cause] || 'GAME OVER';
    g.text(msg, VIEW.W / 2, cy - 84, { size: 13, color: COLORS.danger, letterSpacing: 5, alpha: a });

    g.text('FLOOR', VIEW.W / 2, cy - 40, { size: 12, color: COLORS.textDim, letterSpacing: 4, alpha: a });
    g.text(String(floor), VIEW.W / 2, cy + 10, { size: 76 * pop, color: COLORS.text, weight: 800, alpha: a });

    if (isRecord) {
      const blink = 0.6 + Math.sin(this.t * 9) * 0.4;
      g.text('NEW RECORD', VIEW.W / 2, cy + 58, {
        size: 16, color: COLORS.gold, letterSpacing: 5, alpha: a * blink, weight: 800,
      });
    } else {
      g.text(`BEST  ${best}`, VIEW.W / 2, cy + 58, { size: 14, color: COLORS.textDim, letterSpacing: 3, alpha: a });
    }

    // Retry button — big, centred, and the whole screen works too.
    const bw = 190;
    const bh = 54;
    const bx = VIEW.W / 2 - bw / 2;
    const by = VIEW.H * 0.62;
    const pulse = 0.5 + Math.sin(this.t * 5) * 0.5;
    g.roundRect(bx, by, bw, bh, 27, COLORS.player, (0.14 + pulse * 0.08) * a);
    g.strokeRoundRect(bx, by, bw, bh, 27, COLORS.player, 2, a * (0.75 + pulse * 0.25));
    g.text('RETRY', VIEW.W / 2, by + bh / 2 + 1, { size: 19, color: COLORS.text, letterSpacing: 5, alpha: a, weight: 800 });
    g.text('TAP ANYWHERE', VIEW.W / 2, by + bh + 22, { size: 10, color: COLORS.textDim, letterSpacing: 3, alpha: a * 0.8 });

    return { bx, by, bw, bh };
  }

  drawFlash(color, alpha) {
    if (alpha <= 0.001) return;
    this.gfx.rect(0, 0, VIEW.W, VIEW.H, color, clamp(alpha, 0, 1));
  }

  /** Dark gradient behind the HUD so text stays legible over bright rooms. */
  drawHudScrim() {
    const g = this.gfx.ctx;
    const h = this.vp.hudTop + 78;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(5,6,12,0.85)');
    grad.addColorStop(1, 'rgba(5,6,12,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW.W, h);
  }
}

export { MONO };
