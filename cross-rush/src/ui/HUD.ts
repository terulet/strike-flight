/**
 * HUD.ts
 *
 * Interfaz en carrera: tiempo, mejor tiempo, barra de FLOW/BOOST (con estado
 * REDLINE), sector actual, marca "CROSS RUSH" y cuenta atras / mensajes de
 * estado. Paleta e identidad alineadas con el key art de la marca: naranja
 * quemado sobre negro, con rojo para el estado REDLINE.
 */

import { formatTime } from '../gameplay/Scoring';
import { GameState } from '../gameplay/types';

const BRAND = {
  orange: '#ff6a1a',
  orangeSoft: '#ffb37a',
  red: '#ff2d2d',
} as const;

const FLOW_SEGMENTS = 10;

/**
 * Aplica el estilo de marca "CROSS RUSH": blanco + degradado naranja-rojo,
 * con un contorno negro fino (-webkit-text-stroke: solo el borde, no el
 * relleno, para no tapar el degradado del span "RUSH") y una sombra suave
 * de profundidad.
 */
function styleWordmark(el: HTMLElement, sizePx: number): void {
  el.style.fontFamily = "'Arial Black', 'Segoe UI', system-ui, sans-serif";
  el.style.fontWeight = '900';
  el.style.fontStyle = 'italic';
  el.style.letterSpacing = '-0.5px';
  el.style.lineHeight = '0.95';
  el.style.fontSize = `${sizePx}px`;
  el.style.setProperty('-webkit-text-stroke', `${Math.max(1, sizePx * 0.035)}px #000`);
  el.style.filter = 'drop-shadow(2px 4px 6px rgba(0,0,0,0.6))';
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly deltaEl: HTMLElement;
  private readonly flowSegmentEls: HTMLElement[] = [];
  private readonly flowLabelEl: HTMLElement;
  private readonly sectorEl: HTMLElement;
  private readonly splitEl: HTMLElement;
  private readonly centerMessageEl: HTMLElement;
  private readonly countdownLogoEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.position = 'absolute';
    this.root.style.inset = '0';
    this.root.style.pointerEvents = 'none';
    this.root.style.fontFamily = "'Segoe UI', system-ui, sans-serif";

    // Marca, pequena y siempre visible, arriba a la izquierda (como en el
    // HUD de referencia).
    const logoWrap = document.createElement('div');
    logoWrap.style.position = 'absolute';
    logoWrap.style.top = '8px';
    logoWrap.style.left = '14px';
    logoWrap.style.color = '#fff';
    styleWordmark(logoWrap, 20);
    logoWrap.innerHTML = `CROSS <span style="background:linear-gradient(90deg,${BRAND.orange},${BRAND.red});-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;">RUSH</span>`;

    this.sectorEl = document.createElement('div');
    this.sectorEl.style.position = 'absolute';
    this.sectorEl.style.top = '32px';
    this.sectorEl.style.left = '14px';
    this.sectorEl.style.color = '#fff';
    this.sectorEl.style.fontSize = '13px';
    this.sectorEl.style.letterSpacing = '1.5px';
    this.sectorEl.style.opacity = '0.85';
    this.sectorEl.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
    this.sectorEl.textContent = 'START';

    this.splitEl = document.createElement('div');
    this.splitEl.style.position = 'absolute';
    this.splitEl.style.top = '50px';
    this.splitEl.style.left = '14px';
    this.splitEl.style.color = '#fff';
    this.splitEl.style.fontSize = '15px';
    this.splitEl.style.fontWeight = '800';
    this.splitEl.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
    this.splitEl.style.display = 'none';

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
    this.timeEl.style.borderBottom = `3px solid ${BRAND.orange}`;
    this.timeEl.style.paddingBottom = '2px';
    this.timeEl.textContent = '00:00.000';

    this.bestEl = document.createElement('div');
    this.bestEl.style.fontSize = '14px';
    this.bestEl.style.marginTop = '4px';
    this.bestEl.style.color = BRAND.orangeSoft;
    this.bestEl.textContent = 'BEST --:--.---';

    this.deltaEl = document.createElement('div');
    this.deltaEl.style.fontSize = '16px';
    this.deltaEl.style.fontWeight = '800';
    this.deltaEl.style.marginTop = '2px';
    this.deltaEl.style.color = '#fff';
    this.deltaEl.textContent = 'DELTA ---.---';

    topBar.appendChild(this.timeEl);
    topBar.appendChild(this.bestEl);
    topBar.appendChild(this.deltaEl);

    // Barra de FLOW, estilo "boost" segmentado (ver key art de referencia):
    // una etiqueta arriba y una fila de bloques que se van llenando, en vez
    // de un degradado continuo.
    const flowWrap = document.createElement('div');
    flowWrap.style.position = 'absolute';
    flowWrap.style.left = '14px';
    flowWrap.style.bottom = '18px';

    this.flowLabelEl = document.createElement('div');
    this.flowLabelEl.style.color = '#fff';
    this.flowLabelEl.style.fontSize = '12px';
    this.flowLabelEl.style.fontWeight = '800';
    this.flowLabelEl.style.letterSpacing = '2px';
    this.flowLabelEl.style.marginBottom = '4px';
    this.flowLabelEl.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
    this.flowLabelEl.textContent = 'FLOW';

    const segmentsRow = document.createElement('div');
    segmentsRow.style.display = 'flex';
    segmentsRow.style.gap = '3px';
    for (let i = 0; i < FLOW_SEGMENTS; i++) {
      const seg = document.createElement('div');
      seg.style.width = '20px';
      seg.style.height = '14px';
      seg.style.borderRadius = '2px';
      seg.style.background = 'rgba(0,0,0,0.45)';
      seg.style.border = '1px solid rgba(255,255,255,0.25)';
      seg.style.transition = 'background 0.1s linear, border-color 0.1s linear';
      segmentsRow.appendChild(seg);
      this.flowSegmentEls.push(seg);
    }

    flowWrap.appendChild(this.flowLabelEl);
    flowWrap.appendChild(segmentsRow);

    this.centerMessageEl = document.createElement('div');
    this.centerMessageEl.style.position = 'absolute';
    this.centerMessageEl.style.top = '50%';
    this.centerMessageEl.style.left = '50%';
    this.centerMessageEl.style.transform = 'translate(-50%, -50%)';
    this.centerMessageEl.style.textAlign = 'center';
    this.centerMessageEl.style.fontSize = '64px';
    this.centerMessageEl.style.fontWeight = '900';
    this.centerMessageEl.style.color = '#fff';
    this.centerMessageEl.style.textShadow = '0 3px 10px rgba(0,0,0,0.9)';
    this.centerMessageEl.style.display = 'none';

    // Marca grande detras de la cuenta atras, como momento de titulo.
    this.countdownLogoEl = document.createElement('div');
    this.countdownLogoEl.style.position = 'absolute';
    this.countdownLogoEl.style.top = '50%';
    this.countdownLogoEl.style.left = '50%';
    this.countdownLogoEl.style.transform = 'translate(-50%, -50%) translateY(-90px)';
    this.countdownLogoEl.style.color = '#fff';
    this.countdownLogoEl.style.display = 'none';
    styleWordmark(this.countdownLogoEl, 48);
    this.countdownLogoEl.innerHTML = `CROSS <span style="background:linear-gradient(90deg,${BRAND.orange},${BRAND.red});-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;">RUSH</span>`;

    this.root.appendChild(logoWrap);
    this.root.appendChild(this.sectorEl);
    this.root.appendChild(this.splitEl);
    this.root.appendChild(topBar);
    this.root.appendChild(flowWrap);
    this.root.appendChild(this.countdownLogoEl);
    this.root.appendChild(this.centerMessageEl);
    container.appendChild(this.root);
  }

  setBestTime(seconds: number | null): void {
    this.bestEl.textContent = seconds !== null ? `BEST ${formatTime(seconds)}` : 'BEST --:--.---';
  }

  update(raceTime: number, sector: string, flow: number, isRedline: boolean, deltaSeconds: number | null): void {
    this.timeEl.textContent = formatTime(raceTime);
    this.sectorEl.textContent = sector;
    if (deltaSeconds === null) {
      this.deltaEl.textContent = 'DELTA ---.---';
      this.deltaEl.style.color = '#fff';
    } else {
      this.deltaEl.textContent = `DELTA ${deltaSeconds >= 0 ? '+' : '-'}${Math.abs(deltaSeconds).toFixed(3)}`;
      this.deltaEl.style.color = deltaSeconds <= 0 ? '#65e88b' : BRAND.red;
    }

    const clamped = Math.max(0, Math.min(100, flow));
    const filledSegments = Math.round((clamped / 100) * FLOW_SEGMENTS);
    const activeColor = isRedline ? BRAND.red : BRAND.orange;
    this.flowSegmentEls.forEach((seg, i) => {
      const on = i < filledSegments;
      seg.style.background = on ? activeColor : 'rgba(0,0,0,0.45)';
      seg.style.borderColor = on ? activeColor : 'rgba(255,255,255,0.25)';
      seg.style.boxShadow = on && isRedline ? `0 0 8px ${BRAND.red}` : 'none';
    });
    this.flowLabelEl.textContent = isRedline ? 'REDLINE' : 'FLOW';
    this.flowLabelEl.style.color = isRedline ? BRAND.red : '#fff';
  }

  showSectorSplit(sectorTime: number, deltaSeconds: number | null): void {
    const delta = deltaSeconds === null ? '' : `  ${deltaSeconds >= 0 ? '+' : '-'}${Math.abs(deltaSeconds).toFixed(3)}`;
    this.splitEl.textContent = `SPLIT ${formatTime(sectorTime)}${delta}`;
    this.splitEl.style.color = deltaSeconds === null || deltaSeconds <= 0 ? '#65e88b' : BRAND.red;
    this.splitEl.style.display = 'block';
  }

  hideSectorSplit(): void {
    this.splitEl.style.display = 'none';
  }

  showCenterMessage(text: string): void {
    this.centerMessageEl.textContent = text;
    this.centerMessageEl.style.display = 'block';
    this.countdownLogoEl.style.display = 'block';
  }

  hideCenterMessage(): void {
    this.centerMessageEl.style.display = 'none';
    this.countdownLogoEl.style.display = 'none';
  }

  setGameStateVisibility(state: GameState): void {
    if (state === 'RACING') this.hideCenterMessage();
  }
}
