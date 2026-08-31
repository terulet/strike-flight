/**
 * TouchInput.ts
 *
 * Entrada tactil minima para movil: dos botones (gas/freno) a la derecha y
 * dos zonas de "inclinacion" (tilt) superpuestas para controlar el aire.
 * Se implementa como capa DOM ligera sobre el contenedor que se le pase;
 * si no hay `document` (tests en Node) queda inerte pero valida.
 */

import { InputSource, InputState, neutralInputState } from './InputManager';

/**
 * Margen inferior de los botones (px). No es estetico: la barra de FLOW del
 * HUD vive abajo a la izquierda y ocupa unos 40 px, asi que con el margen de
 * 12 px original los botones de aire se le montaban encima en vertical. Los
 * dos grupos de control usan el mismo valor para quedar alineados.
 */
const CONTROLS_BOTTOM_MARGIN_PX = 64;

interface TouchZone {
  el: HTMLElement;
  active: boolean;
}

export class TouchInput implements InputSource {
  private throttle = false;
  private brake = false;
  private leanZones: { back: TouchZone; forward: TouchZone } | null = null;
  private buttons: { gas: TouchZone; brake: TouchZone } | null = null;
  private restartPressed = false;
  private readonly root: HTMLElement | null;

  constructor(container: HTMLElement | null) {
    this.root = container;
    if (container && typeof document !== 'undefined') {
      this.buildDom(container);
    }
  }

  private buildDom(container: HTMLElement): void {
    const wrap = document.createElement('div');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.style.display = 'flex';
    wrap.style.justifyContent = 'space-between';
    wrap.style.alignItems = 'flex-end';
    wrap.style.pointerEvents = 'none';

    const tiltZone = document.createElement('div');
    tiltZone.style.pointerEvents = 'auto';
    tiltZone.style.display = 'flex';
    tiltZone.style.width = '40%';
    tiltZone.style.height = '35%';
    // Los botones tienen altura fija, asi que sin esto se pegan ARRIBA de una
    // zona que ocupa el 35% de la pantalla y acaban flotando en mitad del
    // area de juego: en un movil de 393x852 quedaban 232 px por encima del
    // gas y el freno, tapando la pista. Alineados abajo, los dos grupos de
    // control quedan a la misma altura y el area de juego queda libre.
    tiltZone.style.alignItems = 'flex-end';
    tiltZone.style.margin = `0 0 ${CONTROLS_BOTTOM_MARGIN_PX}px 12px`;

    const backZone = this.makeZone('◀ AIRE');
    const forwardZone = this.makeZone('AIRE ▶');
    tiltZone.appendChild(backZone.el);
    tiltZone.appendChild(forwardZone.el);
    this.leanZones = { back: backZone, forward: forwardZone };

    const pedalZone = document.createElement('div');
    pedalZone.style.pointerEvents = 'auto';
    pedalZone.style.display = 'flex';
    pedalZone.style.gap = '10px';
    pedalZone.style.margin = `0 12px ${CONTROLS_BOTTOM_MARGIN_PX}px 0`;

    const brakeBtn = this.makeZone('FRENO');
    const gasBtn = this.makeZone('GAS');
    pedalZone.appendChild(brakeBtn.el);
    pedalZone.appendChild(gasBtn.el);
    this.buttons = { gas: gasBtn, brake: brakeBtn };

    wrap.appendChild(tiltZone);
    wrap.appendChild(pedalZone);
    container.appendChild(wrap);
  }

  private makeZone(label: string): TouchZone {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.flex = '1';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.background = 'rgba(24,16,10,0.5)';
    el.style.border = '1px solid rgba(255,106,26,0.5)';
    el.style.borderRadius = '10px';
    el.style.color = '#ffcba3';
    el.style.fontSize = '12px';
    el.style.fontWeight = '700';
    el.style.width = '64px';
    el.style.height = '64px';
    el.style.userSelect = 'none';
    const zone: TouchZone = { el, active: false };
    const setActive = (value: boolean) => (zone.active = value);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setActive(true);
    });
    el.addEventListener('pointerup', () => setActive(false));
    el.addEventListener('pointercancel', () => setActive(false));
    el.addEventListener('pointerleave', () => setActive(false));
    return zone;
  }

  getState(): InputState {
    const state: InputState = neutralInputState();
    state.throttle = this.buttons?.gas.active ?? this.throttle;
    state.brake = this.buttons?.brake.active ?? this.brake;
    const back = this.leanZones?.back.active ?? false;
    const forward = this.leanZones?.forward.active ?? false;
    state.lean = forward && !back ? 1 : back && !forward ? -1 : 0;
    state.restartPressed = this.restartPressed;
    this.restartPressed = false;
    return state;
  }

  /** Permite disparar restart desde un boton externo (p.ej. pantalla de resultados). */
  triggerRestart(): void {
    this.restartPressed = true;
  }

  dispose(): void {
    if (this.root) this.root.innerHTML = '';
  }
}
