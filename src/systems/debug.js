/**
 * Internal tools. Off by default and completely inert until toggled, so the
 * normal game never pays for them.
 *
 * Toggle: backquote or F1, ?debug=1 in the URL, or a long press in the
 * top-left corner (mobile). Keys are listed in the overlay itself.
 */
import { COLORS, VIEW } from '../config.js';
import { clamp } from '../core/math.js';

export class Debug {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.showHitboxes = false;
    this.invincible = false;
    this.showFps = true;
    this.timeScale = 1;
    this.startFloor = 1;
    this.digits = '';
    this.cornerHold = 0;
    this._bind();
    this._readUrl();
  }

  _readUrl() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('debug') === '1') this.enabled = true;
      const f = parseInt(q.get('floor') || '', 10);
      if (Number.isFinite(f) && f > 0) {
        this.startFloor = f;
        this.enabled = true;
      }
    } catch { /* no URL in non-browser contexts */ }
  }

  _bind() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === '`' || k === 'f1' || k === '~') { e.preventDefault(); this.enabled = !this.enabled; return; }
      if (!this.enabled) return;
      switch (k) {
        case 'h': this.showHitboxes = !this.showHitboxes; break;
        case 'i': this.invincible = !this.invincible; break;
        case 'f': this.showFps = !this.showFps; break;
        case 'n': this.game.debugSkipFloor(1); break;
        case 'p': this.game.debugSkipFloor(-1); break;
        case 'r': this.game.startRun(this.startFloor); break;
        case 'm': this.game.toggleMute(); break;
        case '[': this.timeScale = clamp(this.timeScale - 0.25, 0.25, 2); break;
        case ']': this.timeScale = clamp(this.timeScale + 0.25, 0.25, 2); break;
        case 'g': {
          const n = parseInt(this.digits, 10);
          if (Number.isFinite(n) && n > 0) {
            this.startFloor = n;
            this.game.startRun(n);
          }
          this.digits = '';
          break;
        }
        case 'backspace': this.digits = this.digits.slice(0, -1); break;
        default:
          if (/^[0-9]$/.test(k) && this.digits.length < 4) this.digits += k;
          break;
      }
    });
  }

  /** Long-press the top-left corner to open the tools on a touch device. */
  updateTouchToggle(dt, input) {
    if (input.held && input.x < 56 && input.y < 90) {
      this.cornerHold += dt;
      if (this.cornerHold > 1.1) {
        this.enabled = !this.enabled;
        this.cornerHold = -2;
        input.flush();
      }
    } else if (this.cornerHold > 0) {
      this.cornerHold = 0;
    } else if (this.cornerHold < 0) {
      this.cornerHold = Math.min(0, this.cornerHold + dt);
    }
  }

  drawWorld(gfx, game) {
    if (!this.enabled || !this.showHitboxes) return;
    const room = game.room;
    if (!room) return;
    const g = gfx.ctx;
    g.lineWidth = 1;

    g.strokeStyle = '#4c7cff';
    for (const s of room.solids) g.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);

    g.strokeStyle = COLORS.danger;
    for (const h of room.hazards) {
      if (h.kind === 'circle') {
        g.beginPath();
        g.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.strokeRect(h.x + 0.5, h.y + 0.5, h.w - 1, h.h - 1);
      }
    }

    const p = game.player;
    g.strokeStyle = '#ffffff';
    g.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    g.strokeStyle = COLORS.exit;
    g.strokeRect(p.hitX + 0.5, p.hitY + 0.5, p.hitW - 1, p.hitH - 1);
  }

  drawOverlay(gfx, game, fps) {
    if (!this.enabled) return;
    const lines = [
      `state ${game.state.current}  floor ${game.floorNumber}`,
      `fps ${fps.toFixed(0)}  parts ${game.particles.count}  ents ${game.room ? game.room.entities.length : 0}`,
      `pos ${game.player.x.toFixed(0)},${game.player.y.toFixed(0)} v ${game.player.vx.toFixed(0)},${game.player.vy.toFixed(0)}`,
      `${game.player.grounded ? 'GROUND' : 'AIR'} ${game.player.braking ? 'BRAKE' : ''}${game.player.diving ? ' DIVE' : ''} dir ${game.player.dir}`,
      `inv ${this.invincible ? 'ON' : 'off'}  hitbox ${this.showHitboxes ? 'ON' : 'off'}  speed ${this.timeScale.toFixed(2)}`,
      `goto: ${this.digits || '—'}  (0-9 then G)`,
    ];
    const h = lines.length * 12 + 12;
    const y = this.game.viewport.hudTop + 78;
    gfx.rect(6, y, 232, h, '#04060d', 0.82);
    gfx.strokeRoundRect(6, y, 232, h, 2, '#243052', 1, 0.9);
    lines.forEach((l, i) => {
      gfx.text(l, 12, y + 12 + i * 12, { size: 9, color: i === 0 ? COLORS.player : COLORS.textDim, align: 'left', weight: 500 });
    });

    const keys = '` panel · H hitbox · I invuln · N/P floor · R restart · [ ] speed · M mute';
    gfx.text(keys, VIEW.W / 2, VIEW.H - this.game.viewport.hudBottom - 6, {
      size: 8, color: COLORS.textDim, alpha: 0.75,
    });
  }
}
