import type { Medal, RunRecord } from '../core/types';
import { nextMedalGap } from '../systems/ScoreSystem';

export interface ResultData {
  destructionPct: number;
  score: number;
  shotsUsed: number;
  bestChain: number;
  medal: Medal;
  timeMs: number;
  record: RunRecord;
  improved: Partial<Record<keyof RunRecord, boolean>>;
}

const MEDAL_LABEL: Record<Medal, string> = {
  none: 'SIN MEDALLA',
  bronze: 'BRONCE',
  silver: 'PLATA',
  gold: 'ORO',
  crashpoint: 'CRASHPOINT',
};

export class ResultScreen {
  el: HTMLDivElement;

  constructor(private onRetry: () => void, private onNext: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'cp-overlay cp-hidden';
    this.el.innerHTML = `
      <div class="cp-subtitle" style="margin-bottom:6px;">DEMOLITION COMPLETE</div>
      <div class="cp-medal-badge none" data-el="medal"></div>
      <div class="cp-gap-note cp-hidden" data-el="gap"></div>
      <div class="cp-result-grid" data-el="grid"></div>
      <div class="cp-btn-row">
        <button class="cp-btn" id="cp-retry-btn">RETRY</button>
        <button class="cp-btn secondary" id="cp-next-btn" disabled>NEXT · COMING SOON</button>
      </div>
    `;
    this.el.querySelector('#cp-retry-btn')!.addEventListener('click', () => this.onRetry());
    this.el.querySelector('#cp-next-btn')!.addEventListener('click', () => this.onNext());
  }

  show(data: ResultData): void {
    const medalEl = this.el.querySelector('[data-el="medal"]')!;
    medalEl.className = `cp-medal-badge ${data.medal}`;
    medalEl.textContent = MEDAL_LABEL[data.medal];

    const gapEl = this.el.querySelector('[data-el="gap"]')!;
    const gap = nextMedalGap(data.destructionPct);
    if (gap) {
      gapEl.textContent = `${data.destructionPct.toFixed(1)}% · A SOLO ${gap.gap}% DE ${gap.label}`;
      gapEl.classList.remove('cp-hidden');
    } else {
      gapEl.classList.add('cp-hidden');
    }

    const stat = (label: string, value: string, key?: keyof RunRecord) => `
      <div class="cp-result-stat">
        <div class="label">${label}</div>
        <div class="value">${value}${key && data.improved[key] ? '<span class="cp-new-best">NEW BEST</span>' : ''}</div>
      </div>`;

    const grid = this.el.querySelector('[data-el="grid"]')!;
    grid.innerHTML =
      stat('Destrucción', `${data.destructionPct.toFixed(1)}%`, 'bestDestructionPct') +
      stat('Score', data.score.toLocaleString('es-ES'), 'bestScore') +
      stat('Disparos usados', `${data.shotsUsed}`) +
      stat('Mejor chain', `x${data.bestChain}`, 'bestChain') +
      stat('Tiempo', `${(data.timeMs / 1000).toFixed(1)}s`) +
      stat('Récord destrucción', `${data.record.bestDestructionPct.toFixed(1)}%`);

    this.el.classList.remove('cp-hidden');
  }

  hide(): void {
    this.el.classList.add('cp-hidden');
  }
}
