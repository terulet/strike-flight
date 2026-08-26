/**
 * ResultsScreen.ts
 *
 * Pantalla final: TIME / BEST / DELTA / PERFECT LANDINGS / TRICKS / FLOW /
 * STYLE SCORE, con indicador de NEW BEST cuando corresponde.
 */

import { RaceResultsSummary } from '../gameplay/RaceManager';

export class ResultsScreen {
  private readonly root: HTMLElement;

  constructor(container: HTMLElement, private readonly onRestart: () => void) {
    this.root = document.createElement('div');
    this.root.style.position = 'absolute';
    this.root.style.inset = '0';
    this.root.style.display = 'none';
    this.root.style.alignItems = 'center';
    this.root.style.justifyContent = 'center';
    this.root.style.background = 'rgba(6, 8, 14, 0.78)';
    this.root.style.pointerEvents = 'none';
    container.appendChild(this.root);
  }

  show(summary: RaceResultsSummary, crashed: boolean): void {
    this.root.style.display = 'flex';
    this.root.style.pointerEvents = 'auto';
    this.root.innerHTML = '';

    const card = document.createElement('div');
    card.style.background = 'linear-gradient(180deg, #1c1a17, #100e0c)';
    card.style.border = '1px solid rgba(224,170,106,0.28)';
    card.style.borderRadius = '14px';
    card.style.padding = '28px 34px';
    card.style.color = '#fff';
    card.style.minWidth = '280px';
    card.style.textAlign = 'center';
    card.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    card.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)';

    const title = document.createElement('div');
    title.textContent = crashed ? 'CRASH' : 'META';
    title.style.fontSize = '28px';
    title.style.fontWeight = '900';
    title.style.color = crashed ? '#ff5b3d' : '#7cf5c4';
    title.style.marginBottom = '12px';
    card.appendChild(title);

    if (summary.isNewBest && !crashed) {
      const newBest = document.createElement('div');
      newBest.textContent = 'NEW BEST!';
      newBest.style.color = '#ffd23d';
      newBest.style.fontWeight = '800';
      newBest.style.marginBottom = '10px';
      card.appendChild(newBest);
    }

    const rows: Array<[string, string]> = [
      ['TIME', summary.time],
      ['BEST', summary.best ?? '--:--.---'],
      [
        'DELTA',
        summary.deltaSeconds === null
          ? '--'
          : `${summary.deltaSeconds >= 0 ? '+' : ''}${summary.deltaSeconds.toFixed(3)}s`,
      ],
      ['PERFECT LANDINGS', String(summary.perfectLandings)],
      ['TRICKS', String(summary.tricks)],
      ['FLOW', `${summary.flow.toFixed(0)}%`],
      ['STYLE SCORE', String(summary.styleScore)],
    ];

    const table = document.createElement('div');
    table.style.display = 'grid';
    table.style.gridTemplateColumns = '1fr auto';
    table.style.gap = '4px 18px';
    table.style.fontSize = '14px';
    table.style.marginBottom = '18px';
    for (const [label, value] of rows) {
      const l = document.createElement('div');
      l.textContent = label;
      l.style.opacity = '0.7';
      l.style.textAlign = 'left';
      const v = document.createElement('div');
      v.textContent = value;
      v.style.fontWeight = '700';
      v.style.textAlign = 'right';
      table.appendChild(l);
      table.appendChild(v);
    }
    card.appendChild(table);

    const btn = document.createElement('button');
    btn.textContent = 'REINTENTAR (R)';
    btn.style.background = '#e0aa6a';
    btn.style.border = 'none';
    btn.style.color = '#1c1208';
    btn.style.fontWeight = '800';
    btn.style.padding = '10px 20px';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => this.onRestart());
    card.appendChild(btn);

    this.root.appendChild(card);
  }

  hide(): void {
    this.root.style.display = 'none';
    this.root.style.pointerEvents = 'none';
  }
}
