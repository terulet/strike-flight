/**
 * ResultsScreen.ts
 *
 * Pantalla final: TIME / BEST / DELTA / PERFECT LANDINGS / TRICKS / FLOW /
 * STYLE SCORE, con indicador de NEW BEST cuando corresponde. Paleta de marca
 * naranja/negro, con rojo reservado para el estado de crash.
 */

import { RaceResultsSummary } from '../gameplay/RaceManager';

const BRAND = {
  orange: '#ff6a1a',
  orangeSoft: '#ffb37a',
  red: '#ff2d2d',
} as const;

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
    card.style.border = `1px solid ${crashed ? 'rgba(255,45,45,0.35)' : 'rgba(255,106,26,0.35)'}`;
    card.style.borderRadius = '14px';
    card.style.padding = '28px 34px';
    card.style.color = '#fff';
    card.style.minWidth = '280px';
    card.style.textAlign = 'center';
    card.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    card.style.boxShadow = crashed
      ? '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,45,45,0.12)'
      : '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,106,26,0.12)';

    const brand = document.createElement('div');
    brand.textContent = 'CROSS RUSH';
    brand.style.fontSize = '12px';
    brand.style.fontWeight = '800';
    brand.style.letterSpacing = '3px';
    brand.style.opacity = '0.55';
    brand.style.marginBottom = '10px';
    card.appendChild(brand);

    const title = document.createElement('div');
    title.textContent = crashed ? 'CRASH' : 'META';
    title.style.fontSize = '28px';
    title.style.fontWeight = '900';
    title.style.fontStyle = 'italic';
    title.style.color = crashed ? BRAND.red : BRAND.orange;
    title.style.marginBottom = '12px';
    card.appendChild(title);

    if (summary.isNewBest && !crashed) {
      const newBest = document.createElement('div');
      newBest.textContent = 'NEW BEST!';
      newBest.style.color = BRAND.orangeSoft;
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
    btn.style.background = `linear-gradient(90deg, ${BRAND.orange}, ${BRAND.red})`;
    btn.style.border = 'none';
    btn.style.color = '#1c0e06';
    btn.style.fontWeight = '800';
    btn.style.fontStyle = 'italic';
    btn.style.padding = '10px 22px';
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
