/**
 * HUD — lo mínimo, y siempre visible.
 *
 * El HUD es una de las poquísimas cosas que la oscuridad no puede tapar, así
 * que cada elemento que se añade aquí es información que el jugador deja de
 * tener que deducir del mundo. Por eso solo hay tres: munición, integridad y
 * cuántos quedan. Todo lo demás debe conseguirse mirando y escuchando.
 */

import { Config } from '../config/Config.js';

const FONT = '600 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_BIG = '600 30px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_MID = '600 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export class Hud {
  constructor(game) {
    this.game = game;
    this.hintTime = 9;
  }

  render(ctx, W, H) {
    const g = this.game;
    const p = g.player;
    const w = p.weapon;

    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = 'middle';

    // Integridad: tres barras, no un número. Se lee de reojo.
    const barW = 26, barH = 5, gap = 5;
    for (let i = 0; i < Config.player.health; i++) {
      const on = i < p.health;
      ctx.fillStyle = on ? '#ff5c50' : 'rgba(255,92,80,0.16)';
      ctx.fillRect(18 + i * (barW + gap), 20, barW, barH);
    }

    // Munición.
    ctx.textAlign = 'left';
    if (Config.weapon.infiniteAmmo) {
      ctx.fillStyle = 'rgba(180,215,255,0.6)';
      ctx.fillText('∞', 18, 44);
    } else {
      const low = w.mag <= 2;
      ctx.fillStyle = w.isReloading ? '#ffc84a' : low ? '#ff7a5c' : 'rgba(190,225,255,0.86)';
      const mag = w.isReloading ? '· · ·' : String(w.mag).padStart(2, '0');
      ctx.fillText(`${mag} / ${w.reserve}`, 18, 44);
      if (w.isReloading) {
        const k = 1 - w.reloading / Config.weapon.reloadTime;
        ctx.fillStyle = 'rgba(255,200,74,0.25)';
        ctx.fillRect(18, 54, 74, 2);
        ctx.fillStyle = '#ffc84a';
        ctx.fillRect(18, 54, 74 * k, 2);
      } else if (w.canReload && w.mag <= 2) {
        ctx.fillStyle = 'rgba(255,200,74,0.55)';
        ctx.fillText(g.input.touchActive ? 'sin balas · recarga sola' : 'R  recargar', 18, 62);
      }
    }

    // Hostiles restantes.
    const left = g.enemies.filter((e) => e.alive).length;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(190,225,255,0.5)';
    ctx.fillText(`HOSTILES ${left}`, W - 18, 22);
    ctx.fillStyle = 'rgba(190,225,255,0.28)';
    ctx.fillText(this.#clock(g.time), W - 18, 40);

    if (this.hintTime > 0 && g.state === 'playing') {
      this.hintTime -= 1 / 60;
      this.#hint(ctx, W, H);
    }

    if (g.state === 'dead') this.#banner(ctx, W, H, 'TE HAN ENCONTRADO', '#ff5c50');
    if (g.state === 'cleared') this.#banner(ctx, W, H, 'SECTOR DESPEJADO', '#4fd6a0');

    ctx.restore();
  }

  #clock(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  #hint(ctx, W, H) {
    const a = Math.min(1, this.hintTime / 2.2) * 0.5;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(190,225,255,${a})`;
    ctx.font = FONT;
    const touch = this.game.input.touchActive;
    ctx.fillText(
      touch
        ? 'izquierda: moverte   ·   derecha: apuntar y disparar'
        : 'WASD moverte   ·   ratón apuntar   ·   clic disparar   ·   F1 debug',
      W / 2, H - 34,
    );
    ctx.fillStyle = `rgba(255,190,120,${a * 0.9})`;
    ctx.fillText('disparar es la única forma de ver — y de que te oigan', W / 2, H - 16);
  }

  #banner(ctx, W, H, text, color) {
    const g = this.game;
    const k = Math.min(1, g.stateTime / 0.5);
    ctx.fillStyle = `rgba(0,0,0,${0.42 * k})`;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = FONT_BIG;
    ctx.fillStyle = color;
    ctx.globalAlpha = k;
    ctx.fillText(text, W / 2, H / 2 - 16);

    ctx.font = FONT_MID;
    ctx.fillStyle = 'rgba(200,225,255,0.7)';
    const s = g.stats;
    const acc = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
    ctx.fillText(`${this.#clock(g.time)}   ·   ${s.kills} bajas   ·   ${acc}% acierto`, W / 2, H / 2 + 18);
    if (g.session.best > 0 && g.session.runs > 1) {
      ctx.fillStyle = 'rgba(200,225,255,0.35)';
      ctx.font = FONT;
      ctx.fillText(`intento ${g.session.runs}   ·   mejor ${this.#clock(g.session.best)}`, W / 2, H / 2 + 78);
    }

    if (g.stateTime > 0.7) {
      const pulse = 0.45 + Math.sin(g.time * 4) * 0.2;
      ctx.fillStyle = `rgba(200,225,255,${pulse})`;
      ctx.font = FONT;
      ctx.fillText(g.input.touchActive ? 'toca para reintentar' : 'ESPACIO para reintentar', W / 2, H / 2 + 52);
    }
    ctx.globalAlpha = 1;
  }
}
