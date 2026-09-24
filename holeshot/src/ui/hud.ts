/** HUD en DOM: solo escribe cuando algo cambia. */
import { Race, RACE } from '../game/race';
import { TEAR_OFFS } from '../render/lens';
import { fmtDecimal, ordinal, t as tr } from '../i18n';
import { fmtInt, fmtTime, missionName } from './screens';

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

export class Hud {
  private readonly root = $('hud');
  private readonly cache = new Map<string, string>();
  private sectionIdx = -1;
  private sectionTimer = 0;
  private lastCount = -1;

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  setup(race: Race): void {
    const m = race.mission;
    document.documentElement.style.setProperty('--accent', m.theme.accent);
    const t = race.track;
    const span = t.finishX - t.startX;
    $('hTicks').innerHTML = t.checkpoints
      .slice(1)
      .map((x, i) => `<span data-i="${i + 1}" style="left:${(((x - t.startX) / span) * 100).toFixed(2)}%"></span>`)
      .join('');
    this.sectionIdx = -1;
    this.relabel(race);
    $('hStorm').style.display = m.objective === 'storm' ? '' : 'none';
    this.lastCount = -1;
    $('hCount').textContent = '';
    $('hSection').classList.remove('show');
  }

  /** Textos fijos del HUD en el idioma activo (tambien al cambiarlo en la pausa). */
  relabel(race: Race): void {
    const m = race.mission;
    $('hMission').textContent = m.daily ? missionName(m) : `${tr('PRUEBA {n}', { n: m.id })} · ${missionName(m)}`;
    $('hObjLabel').textContent = { time: tr('PUNTOS'), plates: tr('PLACAS'), tricks: tr('PUNTOS DE TRUCO'), storm: tr('TORMENTA'), final: tr('PUESTO') }[m.objective];
    const sec = race.track.sections[this.sectionIdx];
    if (sec) $('hSection').textContent = tr(sec.name);
    this.cache.clear();
  }

  private set(id: string, value: string, prop: 'text' | 'html' | 'width' | 'left' = 'text'): void {
    const key = `${id}:${prop}`;
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    const el = $(id);
    if (prop === 'text') el.textContent = value;
    else if (prop === 'html') el.innerHTML = value;
    else el.style[prop] = value;
  }

  private toggle(id: string, cls: string, on: boolean): void {
    const key = `${id}:.${cls}`;
    const v = on ? '1' : '0';
    if (this.cache.get(key) === v) return;
    this.cache.set(key, v);
    $(id).classList.toggle(cls, on);
  }

  /** Devuelve el numero de la cuenta atras si ha cambiado (para el pitido). */
  update(race: Race, dt: number, lens: { left: number; coverage: number }, ghost: { label: string; delta: number } | null = null): number | null {
    const m = race.mission;
    const b = race.bike;
    this.set('hTime', fmtTime(race.time));
    const md = m.medals;
    if (m.objective === 'tricks') this.set('hTarget', tr('ORO {n} PTS', { n: fmtInt(md.goldScore ?? 0) }));
    else {
      const gold = race.time <= md.gold;
      this.set('hTarget', gold ? tr('ORO {t}', { t: fmtTime(md.gold) }) : tr('PLATA {t}', { t: fmtTime(md.silver) }));
      this.toggle('hTarget', 'lost', !gold);
    }
    const pct = (race.progress * 100).toFixed(2) + '%';
    this.set('hProg', pct, 'width');
    this.set('hRider', pct, 'left');
    const ticks = $('hTicks').children;
    for (let i = 0; i < ticks.length; i++) {
      const on = i + 1 <= race.lastCheckpoint;
      if (ticks[i].classList.contains('on') !== on) ticks[i].classList.toggle('on', on);
    }

    let danger = false;
    switch (m.objective) {
      case 'plates': {
        const total = race.track.pickups.filter((p) => p.kind === 'plate').length;
        this.set('hObj', `${race.platesCollected}/${total}`);
        break;
      }
      case 'tricks':
        this.set('hObj', fmtInt(race.trickScore));
        break;
      case 'storm': {
        const gap = Math.max(0, b.x - race.stormX);
        this.set('hObj', `${Math.round(gap)} m`);
        danger = gap < 16 && race.state !== 'finished';
        this.toggle('hObj', 'warn', danger);
        const span = race.track.finishX - race.track.startX;
        const sp = Math.max(0, Math.min(100, ((race.stormX - race.track.startX) / span) * 100));
        this.set('hStorm', sp.toFixed(1) + '%', 'width');
        break;
      }
      case 'final':
        this.set('hObj', `${ordinal(race.position)}/${race.riders}`);
        break;
      default:
        this.set('hObj', fmtInt(race.score));
    }
    this.set('hPos', race.rivals.length && m.objective !== 'final' ? `${ordinal(race.position)}<small>/ ${race.riders}</small>` : '', 'html');

    // Diferencia con el fantasma del reto (o con tu mejor vuelta).
    if (ghost) {
      const d = ghost.delta;
      const txt = `${d <= 0 ? '−' : '+'}${fmtDecimal(Math.abs(d), 2)} s`;
      this.set('hDelta', `vs ${ghost.label} ${txt}`);
      this.toggle('hDelta', 'ahead', d <= 0);
      this.toggle('hDelta', 'behind', d > 0);
    } else this.set('hDelta', '');

    // Tear-offs que quedan.
    const tearKey = `${lens.left}|${lens.coverage > 0.2 ? 1 : 0}`;
    if (this.cache.get('tear') !== tearKey) {
      this.cache.set('tear', tearKey);
      const el = $('hTear');
      el.classList.toggle('dirty', lens.coverage > 0.2 && lens.left > 0);
      el.innerHTML = `<span>${lens.coverage > 0.2 && lens.left > 0 ? tr('T · LIMPIAR') : 'TEAR-OFFS'}</span>` + Array.from({ length: TEAR_OFFS }, (_, i) => `<i class="${i < lens.left ? '' : 'used'}"></i>`).join('');
    }

    // Medidor de salida en la parrilla.
    const revOn = race.state === 'countdown';
    this.toggle('hRev', 'show', revOn);
    if (revOn) this.set('hRevFill', (Math.min(1, race.revTime / 1.4) * 100).toFixed(1) + '%', 'width');
    this.toggle('hDanger', 'show', danger);

    this.toggle('hCombo', 'show', race.combo > 0);
    if (race.combo > 0) {
      this.set('hComboX', `x${race.comboMultiplier} COMBO`);
      const left = Math.max(0, race.comboTimer) / RACE.comboWindow;
      this.set('hComboBar', (left * 100).toFixed(1) + '%', 'width');
    }
    this.set('hSpeed', String(Math.round(Math.hypot(b.vx, b.vy) * 3.6)));
    this.set('hNitro', ((race.nitro / RACE.nitroMax) * 100).toFixed(1) + '%', 'width');
    $('hNitro').parentElement?.classList.toggle('full', race.nitro >= RACE.nitroMax - 0.5);

    // Nombre del tramo.
    const secs = race.track.sections;
    let idx = -1;
    for (let i = 0; i < secs.length; i++) if (b.x >= secs[i].x - 4) idx = i;
    if (idx !== this.sectionIdx && idx >= 0) {
      this.sectionIdx = idx;
      this.set('hSection', tr(secs[idx].name));
      $('hSection').classList.add('show');
      this.sectionTimer = 2.4;
    }
    if (this.sectionTimer > 0) {
      this.sectionTimer -= dt;
      if (this.sectionTimer <= 0) $('hSection').classList.remove('show');
    }

    // Cuenta atras.
    let changed: number | null = null;
    const cd = $('hCount');
    if (race.state === 'countdown') {
      const n = Math.ceil(race.countdown);
      if (n !== this.lastCount) {
        this.lastCount = n;
        cd.textContent = String(n);
        cd.className = 'countdown';
        void cd.offsetWidth;
        cd.classList.add('tick');
        changed = n;
      }
    } else if (this.lastCount > 0) {
      this.lastCount = 0;
      cd.textContent = tr('¡YA!');
      cd.className = 'countdown go tick';
      changed = 0;
      window.setTimeout(() => {
        if (this.lastCount === 0) cd.textContent = '';
      }, 700);
    }
    return changed;
  }

  popup(big: string, small = '', cls = ''): void {
    const host = $('popups');
    while (host.children.length > 2) host.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.style.top = `${host.children.length * 58}px`;
    el.innerHTML = `${big ? `<div class="big">${big}</div>` : ''}${small ? `<div class="small">${small}</div>` : ''}`;
    host.appendChild(el);
    window.setTimeout(() => el.remove(), 1500);
  }

  clearPopups(): void {
    $('popups').innerHTML = '';
  }
}
