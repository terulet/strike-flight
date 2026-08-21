/**
 * Debug overlay — enabled with ?debug=1 (or the `omm.debug` localStorage flag).
 * Everything an audit of a "that fall was unfair" complaint needs, in one place.
 */
import { SURFACES } from '../config/surfaces.js';
import { OBJECTS } from '../config/objects.js';
import { PhysicsConfig as P } from '../config/PhysicsConfig.js';
import { GameConfig } from '../config/GameConfig.js';
import { toMm, formatMm } from '../ui/format.js';
import { PHASE } from '../physics/Simulation.js';

export class Debug {
  constructor(game, loop) {
    this.game = game;
    this.loop = loop;
    this.el = document.getElementById('debug');
    this.drawWorld = true;
    this.enabled = true;
    this.pre = document.createElement('div');
    this.actions = document.createElement('div');
    this.actions.className = 'dbg-actions';
    this.el.append(this.pre, this.actions);
    this.el.hidden = false;
    this._buildActions();
    this.acc = 0;
  }

  _btn(label, fn) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
    this.actions.appendChild(b);
    return b;
  }

  _buildActions() {
    const g = this.game;
    this._btn('surface', () => {
      const ids = [null, ...SURFACES.map((s) => s.id)];
      const i = ids.indexOf(g.forced.surfaceId);
      g.forced.surfaceId = ids[(i + 1) % ids.length];
      g.startMode(g.match ? g.match.modeId : 'quick');
    });
    this._btn('object', () => {
      const ids = [null, ...OBJECTS.map((o) => o.id)];
      const i = ids.indexOf(g.forced.objectId);
      g.forced.objectId = ids[(i + 1) % ids.length];
      g.startMode(g.match ? g.match.modeId : 'quick');
    });
    this._btn('rival-', () => this._nudgeRival(-1));
    this._btn('rival+', () => this._nudgeRival(1));
    this._btn('replay', () => g.replayLast());
    this._btn('fx', (b) => {
      g.forced.disableFx = !g.forced.disableFx;
      b.style.opacity = g.forced.disableFx ? '0.5' : '1';
    });
    this._btn('boxes', (b) => {
      this.drawWorld = !this.drawWorld;
      b.style.opacity = this.drawWorld ? '1' : '0.5';
    });
    this._btn('wipe', () => { g.save.reset(); g.ui.applyLanguage(); g.quit(); });
    this._btn('x', () => { this.el.hidden = true; this.enabled = false; });
  }

  _nudgeRival(dir) {
    const m = this.game.match;
    if (!m || !m.target) return;
    const next = Math.max(0.05, m.target.mm * (dir > 0 ? 1.4 : 0.7));
    m.target = { ...m.target, mm: next, marginM: next / 1000 };
    this.game._syncHud();
  }

  update(dt) {
    if (!this.enabled) return;
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    const g = this.game;
    const ch = g.challenge;
    const st = g.state;
    const d = ch ? ch.derived : null;
    const margin = st && d ? d.edgeX - (st.x + d.comOffset) : 0;
    const lines = [
      `fps ${this.loop.fps.toFixed(0)}  step ${(1 / P.dt).toFixed(0)}Hz  scale ${g.timeScale.toFixed(2)}`,
      `state ${g.shotState}/${st ? st.phase : '-'}  steps ${st ? st.steps : 0}`,
      `x ${st ? st.x.toFixed(5) : '-'}  v ${st ? st.v.toFixed(5) : '-'}`,
      `com ${st && d ? (st.x + d.comOffset).toFixed(5) : '-'}  edge ${d ? d.edgeX.toFixed(3) : '-'}`,
      `margin ${st ? formatMm(toMm(margin)) : '-'} mm  hang ${st && ch ? formatMm(Math.max(0, toMm(st.x + ch.object.width / 2 - d.edgeX))) : '-'}`,
      `mu ${d ? (d.muEff).toFixed(4) : '-'}  aFric ${d ? d.aFriction.toFixed(3) : '-'}  drag/m ${d ? d.dragPerMass.toFixed(3) : '-'}`,
      `power ${(g.power * 100).toFixed(1)}%  hold ${g.shotState === 'charging' ? Math.round(performance.now() - g.pressAt) : (g.shot ? Math.round(g.shot.holdMs) : 0)}ms`,
      `v0 ${g.shot ? g.shot.v0.toFixed(4) : '-'}  pred ${g.shot ? formatMm(toMm(g.shot.predictedMargin)) : '-'} mm`,
      `seed ${ch ? ch.id : '-'}`,
      `pe ${ch ? ch.pe.toFixed(4) : '-'}  sens ${ch ? ch.meta.sensitivityMmPerMs.toFixed(4) : '-'} mm/ms`,
      `set ${ch ? ch.surfaceId + '/' + ch.objectId + '/' + ch.mutatorId : '-'}`,
      `parts ${g.particles.count}  span ${g.camera.span.toFixed(4)}m  px/m ${g.camera.pxPerM.toFixed(0)}`,
      `forced ${g.forced.surfaceId || '-'}/${g.forced.objectId || '-'}`,
    ];
    this.pre.textContent = lines.join('\n');
  }
}

export function debugEnabled() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('debug') === '1' || q.has('debug')) return true;
    return localStorage.getItem('omm.debug') === '1';
  } catch (e) { return false; }
}

/** URL overrides for reproducing a report: ?surface=ice&object=phone&pe=0.7 */
export function urlOverrides() {
  try {
    const q = new URLSearchParams(location.search);
    const out = {};
    if (q.get('surface')) out.surfaceId = q.get('surface');
    if (q.get('object')) out.objectId = q.get('object');
    if (q.get('pe')) out.pe = Number(q.get('pe'));
    if (q.get('challenge')) out.challengeId = q.get('challenge');
    if (q.get('mode')) out.mode = q.get('mode');
    if (q.get('lang')) out.lang = q.get('lang');
    return out;
  } catch (e) { return {}; }
}
