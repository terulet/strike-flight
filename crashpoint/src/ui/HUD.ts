import { PROJECTILES } from '../entities/Projectile';
import { PROJECTILE_ORDER } from '../systems/ShotSystem';
import type { ProjectileId } from '../core/types';

/** In-game overlay. Deliberately minimal (section 24): shots, projectile, %, score, chain. */
export class HUD {
  el: HTMLDivElement;
  private destructionEl: HTMLElement;
  private scoreEl: HTMLElement;
  private chainBanner: HTMLElement;
  private powerMeter: HTMLElement;
  private powerFill: HTMLElement;
  private projButtons = new Map<ProjectileId, HTMLButtonElement>();
  private chainHideTimer: number | null = null;

  constructor(private onSelectProjectile: (id: ProjectileId) => void) {
    this.el = document.createElement('div');
    this.el.className = 'cp-hud cp-hidden';
    this.el.innerHTML = `
      <div class="cp-hud-top">
        <div class="cp-stats">
          <div class="cp-pill">DESTRUCCIÓN <span class="val" data-el="destruction">0%</span></div>
          <div class="cp-pill">SCORE <span class="val" data-el="score">0</span></div>
        </div>
      </div>
      <div class="cp-chain-banner" data-el="chain"></div>
      <div class="cp-power-meter" data-el="power-meter"><div class="cp-power-fill" data-el="power-fill"></div></div>
      <div class="cp-hud-bottom">
        <div class="cp-projectiles" data-el="projectiles"></div>
      </div>
    `;
    this.destructionEl = this.el.querySelector('[data-el="destruction"]')!;
    this.scoreEl = this.el.querySelector('[data-el="score"]')!;
    this.chainBanner = this.el.querySelector('[data-el="chain"]')!;
    this.powerMeter = this.el.querySelector('[data-el="power-meter"]')!;
    this.powerFill = this.el.querySelector('[data-el="power-fill"]')!;

    const projectilesEl = this.el.querySelector('[data-el="projectiles"]')!;
    for (const id of PROJECTILE_ORDER) {
      const cfg = PROJECTILES[id];
      const btn = document.createElement('button');
      btn.className = 'cp-proj-btn';
      btn.style.position = 'relative';
      btn.innerHTML = `<span class="dot" style="background:${cfg.color}"></span><span>${cfg.label.split(' ')[0]}</span>`;
      btn.addEventListener('click', () => this.onSelectProjectile(id));
      projectilesEl.appendChild(btn);
      this.projButtons.set(id, btn);
    }
  }

  show(): void {
    this.el.classList.remove('cp-hidden');
  }
  hide(): void {
    this.el.classList.add('cp-hidden');
  }

  setProjectileSelection(selected: ProjectileId, shotsRemaining: number): void {
    for (const [id, btn] of this.projButtons) {
      btn.classList.toggle('active', id === selected);
      btn.disabled = shotsRemaining <= 0;
    }
  }

  setStats(destructionPct: number, score: number): void {
    this.destructionEl.textContent = `${destructionPct.toFixed(1)}%`;
    this.scoreEl.textContent = Math.round(score).toLocaleString('es-ES');
  }

  showChain(length: number): void {
    if (length < 2) return;
    this.chainBanner.textContent = `CHAIN x${length}`;
    this.chainBanner.classList.add('show');
    if (this.chainHideTimer) window.clearTimeout(this.chainHideTimer);
    this.chainHideTimer = window.setTimeout(() => this.chainBanner.classList.remove('show'), 900);
  }

  setPower(power: number | null): void {
    if (power === null) {
      this.powerMeter.classList.remove('show');
      return;
    }
    this.powerMeter.classList.add('show');
    this.powerFill.style.width = `${Math.round(power * 100)}%`;
  }

  reset(): void {
    this.setStats(0, 0);
    this.chainBanner.classList.remove('show');
    this.setPower(null);
  }
}
