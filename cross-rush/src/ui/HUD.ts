/**
 * HUD.ts
 *
 * Interfaz en carrera: tiempo, mejor tiempo, barra de FLOW (con estado
 * REDLINE), sector actual y cuenta atras / mensajes de estado.
 */

import { formatTime } from '../gameplay/Scoring';
import { GameState } from '../gameplay/types';

export class HUD {
  private readonly root: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly flowFillEl: HTMLElement;
  private readonly sectorEl: HTMLElement;
  private readonly centerMessageEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.position = 'absolute';
    this.root.style.inset = '0';
    this.root.style.pointerEvents = 'none';
    this.root.style.fontFamily = "'Segoe UI', system-ui, sans-serif";

    const topBar = document.createElement('div');
    topBar.style.position = 'absolute';
    topBar.style.top = '10px';
    topBar.style.right = '14px';
    topBar.style.textAlign = 'right';
    topBar.style.color = '#fff';
    topBar.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';

    this.timeEl = document.createElement('div');
    this.timeEl.style.fontSize = '28px';
    this.timeEl.style.fontWeight = '800';
    this.timeEl.textContent = '00:00.000';

    this.bestEl = document.createElement('div');
    this.bestEl.style.fontSize = '14px';
    this.bestEl.style.opacity = '0.8';
    this.bestEl.textContent = 'BEST --:--.---';

    topBar.appendChild(this.timeEl);
    topBar.appendChild(this.bestEl);

    this.sectorEl = document.createElement('div');
    this.sectorEl.style.position = 'absolute';
    this.sectorEl.style.top = '10px';
    this.sectorEl.style.left = '14px';
    this.sectorEl.style.color = '#fff';
    this.sectorEl.style.fontSize = '14px';
    this.sectorEl.style.letterSpacing = '1px';
    this.sectorEl.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
    this.sectorEl.textContent = 'START';

    const flowWrap = document.createElement('div');
    flowWrap.style.position = 'absolute';
    flowWrap.style.left = '14px';
    flowWrap.style.bottom = '18px';
    flowWrap.style.width = '220px';
    flowWrap.style.height = '14px';
    flowWrap.style.border = '2px solid rgba(255,255,255,0.6)';
    flowWrap.style.borderRadius = '8px';
    flowWrap.style.overflow = 'hidden';
    flowWrap.style.background = 'rgba(0,0,0,0.4)';

    this.flowFillEl = document.createElement('div');
    this.flowFillEl.style.height = '100%';
    this.flowFillEl.style.width = '0%';
    this.flowFillEl.style.background = 'linear-gradient(90deg, #3fa8ff, #7cf5c4)';
    this.flowFillEl.style.transition = 'width 0.08s linear, background 0.2s linear';
    flowWrap.appendChild(this.flowFillEl);

    this.centerMessageEl = document.createElement('div');
    this.centerMessageEl.style.position = 'absolute';
    this.centerMessageEl.style.top = '50%';
    this.centerMessageEl.style.left = '50%';
    this.centerMessageEl.style.transform = 'translate(-50%, -50%)';
    this.centerMessageEl.style.fontSize = '64px';
    this.centerMessageEl.style.fontWeight = '900';
    this.centerMessageEl.style.color = '#fff';
    this.centerMessageEl.style.textShadow = '0 3px 10px rgba(0,0,0,0.9)';
    this.centerMessageEl.style.display = 'none';

    this.root.appendChild(topBar);
    this.root.appendChild(this.sectorEl);
    this.root.appendChild(flowWrap);
    this.root.appendChild(this.centerMessageEl);
    container.appendChild(this.root);
  }

  setBestTime(seconds: number | null): void {
    this.bestEl.textContent = seconds !== null ? `BEST ${formatTime(seconds)}` : 'BEST --:--.---';
  }

  update(raceTime: number, sector: string, flow: number, isRedline: boolean): void {
    this.timeEl.textContent = formatTime(raceTime);
    this.sectorEl.textContent = sector;
    this.flowFillEl.style.width = `${Math.max(0, Math.min(100, flow))}%`;
    this.flowFillEl.style.background = isRedline
      ? 'linear-gradient(90deg, #ff5b3d, #ffd23d)'
      : 'linear-gradient(90deg, #3fa8ff, #7cf5c4)';
  }

  showCenterMessage(text: string): void {
    this.centerMessageEl.textContent = text;
    this.centerMessageEl.style.display = 'block';
  }

  hideCenterMessage(): void {
    this.centerMessageEl.style.display = 'none';
  }

  setGameStateVisibility(state: GameState): void {
    if (state === 'RACING') this.hideCenterMessage();
  }
}
