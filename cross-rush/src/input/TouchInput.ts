/**
 * TouchInput.ts
 *
 * Controles tactiles: aire atras / aire adelante a la izquierda, freno y gas
 * a la derecha. Capa DOM ligera sobre el contenedor que se le pase; si no hay
 * `document` (tests en Node) queda inerte pero valida.
 *
 * Tres cambios respecto a la version anterior, todos de la fase de
 * presentacion:
 *
 * 1. SOLO EN TACTIL. Antes se dibujaban siempre, asi que en escritorio habia
 *    una franja de botones ocupando el borde inferior de la pantalla que
 *    nadie podia pulsar con el raton de forma util. Ahora solo aparecen si el
 *    dispositivo tiene puntero grueso o pantalla tactil, y se reevalua al
 *    rotar o redimensionar (un portatil con pantalla tactil los tendra; un
 *    monitor, no).
 *
 * 2. TAMANO, CONTRASTE Y POSICION. Botones redondos de 78 px (68 en pantallas
 *    pequenas), separados en dos grupos pegados a las esquinas inferiores,
 *    con relleno opaco y borde claro. Los anteriores eran rectangulos casi
 *    transparentes estirados al 40% del ancho de pantalla.
 *
 * 3. FEEDBACK AL PULSAR. Se hunden, se encienden y cambian de borde, ademas
 *    de una vibracion corta donde el navegador la permita. Antes no cambiaba
 *    nada al tocar.
 *
 * La geometria y el respeto a las safe areas de iPhone/iPad viven en UiTheme.
 */

import { InputSource, InputState, neutralInputState } from './InputManager';
import { ensureUiStyles } from '../ui/UiTheme';

interface TouchZone {
  el: HTMLElement;
  active: boolean;
}

/**
 * ¿Merece la pena mostrar botones en pantalla? Puntero grueso o pantalla
 * tactil. Se comprueba en cada evaluacion en vez de una sola vez al arrancar
 * porque el modo de dispositivo del navegador y las tablets con teclado
 * cambian la respuesta en caliente.
 */
function isTouchLikeDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return coarse || touchPoints;
}

export class TouchInput implements InputSource {
  private leanZones: { back: TouchZone; forward: TouchZone } | null = null;
  private buttons: { gas: TouchZone; brake: TouchZone; boost: TouchZone } | null = null;
  private restartPressed = false;
  /** Flanco de subida del turbo: se consume al leerlo. */
  private boostEdge = false;
  private readonly wrap: HTMLElement | null = null;

  constructor(container: HTMLElement | null) {
    if (!container || typeof document === 'undefined') return;
    ensureUiStyles();
    this.wrap = this.buildDom(container);
    this.applyVisibility();
    window.addEventListener('resize', () => this.applyVisibility());
    window.addEventListener('orientationchange', () => this.applyVisibility());
  }

  private buildDom(container: HTMLElement): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cr-layer';

    const left = document.createElement('div');
    left.className = 'cr-pad left';
    const back = this.makeButton('◀', 'AIRE', 'lean-back');
    const forward = this.makeButton('▶', 'AIRE', 'lean-fwd');
    left.appendChild(back.el);
    left.appendChild(forward.el);
    this.leanZones = { back, forward };

    const right = document.createElement('div');
    right.className = 'cr-pad right column';
    // El turbo va ENCIMA de freno y gas, no en la misma fila. Con los cinco
    // botones en linea, en 393 px de ancho se solapaban; y ademas el turbo se
    // pulsa de higos a brevas mientras que freno y gas se usan todo el rato,
    // asi que el sitio bueno para el pulgar es para ellos.
    const boost = this.makeButton('⚡', 'TURBO', 'boost');
    const pedals = document.createElement('div');
    pedals.className = 'cr-pad-row';
    const brake = this.makeButton('⊘', 'FRENO', 'brake');
    const gas = this.makeButton('▲', 'GAS', 'gas');
    pedals.appendChild(brake.el);
    pedals.appendChild(gas.el);
    right.appendChild(boost.el);
    right.appendChild(pedals);
    this.buttons = { gas, brake, boost };

    wrap.appendChild(left);
    wrap.appendChild(right);
    container.appendChild(wrap);
    return wrap;
  }

  private applyVisibility(): void {
    if (!this.wrap) return;
    const show = isTouchLikeDevice();
    this.wrap.style.display = show ? 'block' : 'none';
    if (!show) {
      // Si se oculta con un boton pulsado, el estado se quedaria enganchado y
      // la moto seguiria acelerando sola.
      for (const zone of [this.leanZones?.back, this.leanZones?.forward, this.buttons?.gas, this.buttons?.brake]) {
        if (zone) this.setActive(zone, false);
      }
    }
  }

  private setActive(zone: TouchZone, value: boolean): void {
    if (zone.active === value) return;
    if (value && zone === this.buttons?.boost) this.boostEdge = true;
    zone.active = value;
    zone.el.classList.toggle('active', value);
    if (value && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
  }

  private makeButton(icon: string, label: string, variant: string): TouchZone {
    const el = document.createElement('div');
    el.className = `cr-btn ${variant}`;
    el.innerHTML = `<span class="cr-btn-icon">${icon}</span><span>${label}</span>`;
    const zone: TouchZone = { el, active: false };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Capturar el puntero: sin esto, deslizar un poco el dedo fuera del
      // circulo suelta el gas en mitad de un salto.
      if (el.setPointerCapture && e.pointerId !== undefined) el.setPointerCapture(e.pointerId);
      this.setActive(zone, true);
    });
    const release = () => this.setActive(zone, false);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    return zone;
  }

  getState(): InputState {
    const state: InputState = neutralInputState();
    state.throttle = this.buttons?.gas.active ?? false;
    state.brake = this.buttons?.brake.active ?? false;
    const back = this.leanZones?.back.active ?? false;
    const forward = this.leanZones?.forward.active ?? false;
    state.lean = forward && !back ? 1 : back && !forward ? -1 : 0;
    state.restartPressed = this.restartPressed;
    this.restartPressed = false;
    state.boostPressed = this.boostEdge;
    this.boostEdge = false;
    return state;
  }

  /** Enciende el boton de turbo cuando hay carga que gastar. */
  setBoostReady(ready: boolean): void {
    this.buttons?.boost.el.classList.toggle('ready', ready);
  }

  /** Permite disparar restart desde un boton externo (p.ej. pantalla de resultados). */
  triggerRestart(): void {
    this.restartPressed = true;
  }

  dispose(): void {
    this.wrap?.remove();
  }
}
