/**
 * HUD.ts
 *
 * Interfaz en carrera: crono, record, delta, barra de FLOW (con estado
 * REDLINE), split de sector, marca "CROSS RUSH" y el momento central de
 * cuenta atras / meta.
 *
 * El rediseno persigue una sola cosa: que los tres numeros que importan
 * -tiempo, record y delta- se lean SIEMPRE. Antes eran texto blanco con
 * sombra flotando sobre el cielo; en cuanto la camara subia y el fondo era
 * arena clara, el crono desaparecia. Ahora van sobre una placa oscura con
 * desenfoque, con digitos de ancho fijo (tabular-nums, si no el crono baila
 * varias veces por segundo) y el delta en una pastilla verde/roja que se
 * entiende sin leerla.
 *
 * La colocacion y los tamanos viven en UiTheme (media queries + safe areas),
 * no en estilos en linea: es lo que permite que el mismo HUD funcione en
 * 1366x768 y en 393x852 con el notch de por medio.
 */

import { formatTime } from '../gameplay/Scoring';
import { GameState } from '../gameplay/types';
import { BRAND, ensureUiStyles } from './UiTheme';

const FLOW_SEGMENTS = 10;

const WORDMARK = 'CROSS <em>RUSH</em>';

export class HUD {
  private readonly root: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly deltaEl: HTMLElement;
  private readonly flowSegmentEls: HTMLElement[] = [];
  private readonly flowLabelEl: HTMLElement;
  private readonly flowWrapEl: HTMLElement;
  private readonly splitEl: HTMLElement;
  private readonly centerEl: HTMLElement;
  private readonly centerMessageEl: HTMLElement;
  private readonly centerBrandEl: HTMLElement;
  private readonly scoreValueEl: HTMLElement;
  private readonly scoreMultEl: HTMLElement;
  private readonly awardsEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly comboMultEl: HTMLElement;
  private readonly comboLabelEl: HTMLElement;
  private readonly comboFillEl: HTMLElement;
  private lastComboLinks = 0;
  /** Ultimo texto central mostrado, para no reiniciar la animacion cada frame. */
  private lastCenterText: string | null = null;

  constructor(container: HTMLElement) {
    ensureUiStyles();

    this.root = document.createElement('div');
    this.root.className = 'cr-layer';

    const brand = document.createElement('div');
    brand.className = 'cr-brand';
    brand.innerHTML = WORDMARK;

    // -------------------------------------------------------------- crono
    const board = document.createElement('div');
    board.className = 'cr-board cr-plate';

    const boardLabel = document.createElement('div');
    boardLabel.className = 'cr-board-label';
    boardLabel.textContent = 'TIEMPO';

    this.timeEl = document.createElement('div');
    this.timeEl.className = 'cr-time';
    this.timeEl.textContent = '0:00.000';

    const row = document.createElement('div');
    row.className = 'cr-board-row';

    this.bestEl = document.createElement('div');
    this.bestEl.className = 'cr-best';
    this.bestEl.innerHTML = '<b>RECORD</b>--:--.---';

    this.deltaEl = document.createElement('div');
    this.deltaEl.className = 'cr-delta';
    this.deltaEl.textContent = '--.---';

    row.appendChild(this.bestEl);
    row.appendChild(this.deltaEl);
    // Puntuacion y multiplicador, bajo el crono: es el marcador del
    // espectaculo -aterrizajes clavados, trucos, aros y huecos- y va donde ya
    // esta mirando el jugador para leer el tiempo.
    const score = document.createElement('div');
    score.className = 'cr-score';
    this.scoreMultEl = document.createElement('div');
    this.scoreMultEl.className = 'cr-score-mult';
    this.scoreMultEl.textContent = 'x1';
    this.scoreValueEl = document.createElement('div');
    this.scoreValueEl.className = 'cr-score-value';
    this.scoreValueEl.textContent = '0';
    score.appendChild(this.scoreMultEl);
    score.appendChild(this.scoreValueEl);

    board.appendChild(boardLabel);
    board.appendChild(this.timeEl);
    board.appendChild(row);
    board.appendChild(score);

    this.awardsEl = document.createElement('div');
    this.awardsEl.className = 'cr-awards';

    // ------------------------------------------------------------- cadena
    this.comboEl = document.createElement('div');
    this.comboEl.className = 'cr-combo';
    this.comboMultEl = document.createElement('div');
    this.comboMultEl.className = 'cr-combo-mult';
    this.comboLabelEl = document.createElement('div');
    this.comboLabelEl.className = 'cr-combo-label';
    const comboBar = document.createElement('div');
    comboBar.className = 'cr-combo-bar';
    this.comboFillEl = document.createElement('div');
    this.comboFillEl.className = 'cr-combo-fill';
    comboBar.appendChild(this.comboFillEl);
    this.comboEl.appendChild(this.comboMultEl);
    this.comboEl.appendChild(this.comboLabelEl);
    this.comboEl.appendChild(comboBar);

    // --------------------------------------------------------------- flow
    const flowWrap = document.createElement('div');
    flowWrap.className = 'cr-flow';
    this.flowWrapEl = flowWrap;

    this.flowLabelEl = document.createElement('div');
    this.flowLabelEl.className = 'cr-flow-label';
    this.flowLabelEl.textContent = 'FLOW';

    const bar = document.createElement('div');
    bar.className = 'cr-flow-bar';
    for (let i = 0; i < FLOW_SEGMENTS; i++) {
      const seg = document.createElement('div');
      seg.className = 'cr-flow-seg';
      bar.appendChild(seg);
      this.flowSegmentEls.push(seg);
    }
    flowWrap.appendChild(this.flowLabelEl);
    flowWrap.appendChild(bar);

    this.splitEl = document.createElement('div');
    this.splitEl.className = 'cr-split';

    // ------------------------------------------------------------- centro
    this.centerEl = document.createElement('div');
    this.centerEl.className = 'cr-center';

    this.centerBrandEl = document.createElement('div');
    this.centerBrandEl.className = 'cr-center-brand';
    this.centerBrandEl.innerHTML = WORDMARK;

    this.centerMessageEl = document.createElement('div');
    this.centerMessageEl.className = 'cr-center-msg';

    this.centerEl.appendChild(this.centerBrandEl);
    this.centerEl.appendChild(this.centerMessageEl);

    this.root.appendChild(brand);
    this.root.appendChild(board);
    this.root.appendChild(flowWrap);
    this.root.appendChild(this.splitEl);
    this.root.appendChild(this.awardsEl);
    this.root.appendChild(this.comboEl);
    this.root.appendChild(this.centerEl);
    container.appendChild(this.root);
  }

  setBestTime(seconds: number | null): void {
    this.bestEl.innerHTML = `<b>RECORD</b>${seconds !== null ? formatTime(seconds) : '--:--.---'}`;
  }

  /** Marcador de estilo y multiplicador vigente. */
  setScore(score: number, multiplier: number): void {
    this.scoreValueEl.textContent = score.toLocaleString('es-ES');
    this.scoreMultEl.textContent = `x${multiplier}`;
    this.scoreMultEl.classList.toggle('hot', multiplier > 1);
  }

  /**
   * Cadena de acrobacias. El latigazo de escala se dispara solo cuando SUBE
   * el numero de eslabones: se llama una vez por fotograma, asi que
   * relanzarlo siempre lo dejaria congelado en su primer cuadro.
   */
  setCombo(links: number, multiplier: number, remainingFraction: number): void {
    if (links <= 0) {
      this.comboEl.style.display = 'none';
      this.lastComboLinks = 0;
      return;
    }
    this.comboEl.style.display = 'block';
    this.comboMultEl.textContent = `x${multiplier}`;
    this.comboLabelEl.textContent = `${links} EN CADENA`;
    this.comboFillEl.style.transform = `scaleX(${Math.max(0, Math.min(1, remainingFraction))})`;
    if (links > this.lastComboLinks) {
      this.comboMultEl.classList.remove('cr-combo-pop');
      void this.comboMultEl.offsetWidth;
      this.comboMultEl.classList.add('cr-combo-pop');
    }
    this.lastComboLinks = links;
  }

  /**
   * Cartel de premio: sube desde el centro y se desvanece. El elemento se
   * borra solo al acabar la animacion, asi que encadenar varios premios
   * seguidos -que es lo normal en el tramo de espectaculo- no deja basura en
   * el DOM ni obliga a llevar la cuenta desde fuera.
   */
  /**
   * Cartel central. `tone` decide si es una celebracion o un aviso: desde que
   * aterrizar regular cuesta velocidad y un eslabon, el jugador necesita ver
   * lo que ha perdido igual que ve lo que gana.
   */
  showAward(text: string, points?: number, tone: 'reward' | 'penalty' = 'reward'): void {
    const el = document.createElement('div');
    el.className = tone === 'penalty' ? 'cr-award penalty' : 'cr-award';
    const suffix = points === undefined ? '' : `<span>${tone === 'penalty' ? '' : '+'}${points}</span>`;
    el.innerHTML = `${text}${suffix}`;
    el.addEventListener('animationend', () => el.remove());
    this.awardsEl.appendChild(el);
    // Cinturon y tirantes: si el navegador no lanza animationend (pestana en
    // segundo plano), el cartel se retira igualmente.
    window.setTimeout(() => el.remove(), 2500);
  }

  update(
    raceTime: number,
    sector: string,
    flow: number,
    isRedline: boolean,
    deltaSeconds: number | null,
    boostReady = false,
  ): void {
    this.timeEl.textContent = formatTime(raceTime);
    if (deltaSeconds === null) {
      this.deltaEl.textContent = '--.---';
      this.deltaEl.className = 'cr-delta';
    } else {
      this.deltaEl.textContent = `${deltaSeconds >= 0 ? '+' : '-'}${Math.abs(deltaSeconds).toFixed(3)}`;
      this.deltaEl.className = `cr-delta ${deltaSeconds <= 0 ? 'ahead' : 'behind'}`;
    }

    const clamped = Math.max(0, Math.min(100, flow));
    const filledSegments = Math.round((clamped / 100) * FLOW_SEGMENTS);
    const activeColor = isRedline ? BRAND.red : BRAND.orange;
    this.flowSegmentEls.forEach((seg, i) => {
      const on = i < filledSegments;
      seg.style.background = on ? activeColor : '';
      seg.style.borderColor = on ? activeColor : '';
      seg.style.boxShadow = on && isRedline ? `0 0 8px ${BRAND.red}` : '';
    });
    this.flowLabelEl.textContent = isRedline ? 'REDLINE' : boostReady ? 'TURBO LISTO' : 'FLOW';
    this.flowLabelEl.style.color = isRedline ? BRAND.red : '';
    this.flowWrapEl.classList.toggle('ready', boostReady && !isRedline);
    void sector;
  }

  showSectorSplit(sectorTime: number, deltaSeconds: number | null): void {
    const delta = deltaSeconds === null ? '' : `  ${deltaSeconds >= 0 ? '+' : '-'}${Math.abs(deltaSeconds).toFixed(3)}`;
    this.splitEl.textContent = `PARCIAL ${formatTime(sectorTime)}${delta}`;
    this.splitEl.style.color = deltaSeconds === null || deltaSeconds <= 0 ? BRAND.green : BRAND.red;
    this.splitEl.style.display = 'block';
  }

  hideSectorSplit(): void {
    this.splitEl.style.display = 'none';
  }

  /**
   * Mensaje central. `emphasis` marca el momento de salida: el texto sale
   * disparado hacia la camara en vez de limitarse a aparecer.
   *
   * La animacion se reinicia SOLO cuando cambia el texto. Se llama una vez
   * por fotograma, asi que reiniciarla siempre la dejaria congelada en el
   * primer fotograma para siempre.
   */
  showCenterMessage(text: string, emphasis = false): void {
    this.centerEl.style.display = 'block';
    if (text === this.lastCenterText) return;
    this.lastCenterText = text;
    this.centerMessageEl.textContent = text;
    this.centerMessageEl.className = 'cr-center-msg';
    // Forzar reflow para poder relanzar la animacion con la misma clase.
    void this.centerMessageEl.offsetWidth;
    this.centerMessageEl.classList.add(emphasis ? 'cr-go' : 'cr-pop');
    this.centerBrandEl.style.display = emphasis ? 'none' : 'block';
  }

  hideCenterMessage(): void {
    this.centerEl.style.display = 'none';
    this.lastCenterText = null;
  }

  setGameStateVisibility(state: GameState): void {
    if (state === 'RACING') this.hideCenterMessage();
  }
}
