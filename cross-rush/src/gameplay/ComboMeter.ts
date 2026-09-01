/**
 * ComboMeter.ts
 *
 * Cadena de acrobacias. Cada cosa que puntua -un aterrizaje clavado, un
 * mortal, un aro, saltar el hueco- suma un eslabon y reinicia una cuenta
 * atras; si pasa la ventana sin nada, la cadena se cierra. Un choque la rompe
 * en el acto, y una recepcion regular se lleva un eslabon por delante.
 *
 * La ventana SE ESTRECHA con cada eslabon, y esa es la pieza que hace que la
 * cadena valga algo. Con una ventana fija de 4,5 s la cadena era gratis: la
 * pista tiene un salto cada 2,4 s de media, asi que no habia forma de dejarla
 * caducar ni queriendo, y el piloto automatico competente sacaba la misma
 * cadena que el perfecto. Estrechandola, una cadena larga obliga a enlazar
 * cada vez mas rapido -a elegir la linea que encadena en vez de la comoda- y
 * el numero vuelve a decir algo sobre como se esta jugando.
 *
 * El multiplicador NO es el numero de eslabones. Sube de escalon en escalon
 * (x1, x2, x3...) segun cuantos eslabones lleves, con el ultimo escalon
 * abierto: es lo que hace que encadenar sea cualitativamente distinto de
 * repetir. Y va aparte del multiplicador de REDLINE, que premia conducir
 * rapido; los dos se multiplican entre si, asi que la puntuacion grande sale
 * de hacer las dos cosas a la vez y no de insistir en una.
 *
 * Es puro estado de juego, sin nada de render ni de audio: el HUD lo lee, no
 * lo gobierna.
 */

import { ComboConfig } from '../config/GameConfig';

export class ComboMeter {
  private _links = 0;
  private _remaining = 0;
  /** Eslabones de la cadena mas larga de la carrera, para el resumen final. */
  private _best = 0;

  get links(): number {
    return this._links;
  }

  get bestLinks(): number {
    return this._best;
  }

  get isActive(): boolean {
    return this._links > 0;
  }

  /** Segundos que le quedan a la cadena antes de cerrarse sola. */
  get remainingSeconds(): number {
    return this._remaining;
  }

  /**
   * Ventana vigente: la inicial menos lo que se ha estrechado por eslabon, con
   * un suelo para que siga siendo dificil y no imposible.
   */
  get windowSeconds(): number {
    const shrunk = ComboConfig.windowSeconds - ComboConfig.windowDecayPerLink * Math.max(0, this._links - 1);
    return Math.max(ComboConfig.minWindowSeconds, shrunk);
  }

  /** 0..1, para dibujar la barra que se vacia. */
  get remainingFraction(): number {
    const window = this.windowSeconds;
    return window > 0 ? Math.min(1, this._remaining / window) : 0;
  }

  /**
   * Multiplicador vigente. El ultimo escalon queda abierto a proposito: una
   * cadena larguisima sigue siendo la mejor, pero sin que el numero se
   * dispare a lo absurdo.
   */
  get multiplier(): number {
    if (this._links <= 0) return 1;
    const step = Math.min(ComboConfig.steps.length - 1, this._links - 1);
    return ComboConfig.steps[step];
  }

  reset(): void {
    this._links = 0;
    this._remaining = 0;
    this._best = 0;
  }

  /** Suma un eslabon y reinicia la ventana. Devuelve el multiplicador ya actualizado. */
  add(): number {
    this._links += 1;
    this._best = Math.max(this._best, this._links);
    this._remaining = this.windowSeconds;
    return this.multiplier;
  }

  /**
   * Recepcion correcta pero no clavada: MANTIENE la cadena viva sin hacerla
   * crecer. Es la diferencia entre "no la has roto" y "la has alargado", y es
   * lo que hace que la cadena mida precision y no simple presencia de saltos:
   * medido, el piloto competente sacaba la MISMA cadena que el perfecto
   * mientras un GOOD sumaba eslabon, porque tenia mas GOOD justamente por ir
   * peor colocado.
   */
  refresh(): void {
    if (this._links <= 0) return;
    this._remaining = this.windowSeconds;
  }

  /**
   * Recepcion regular o mala: se lleva un eslabon por delante y reinicia la
   * ventana con la que quede. No rompe -romper entera por un aterrizaje
   * regular castiga tanto que el jugador deja de intentarlo-, pero se nota en
   * el acto porque puede bajar de escalon de multiplicador.
   */
  penalize(): number {
    if (this._links <= 0) return this.multiplier;
    this._links = Math.max(0, this._links - ComboConfig.sloppyLandingPenalty);
    this._remaining = this._links > 0 ? this.windowSeconds : 0;
    return this.multiplier;
  }

  /** Rompe la cadena en el acto (choque). */
  break(): void {
    this._links = 0;
    this._remaining = 0;
  }

  /**
   * Avanza el reloj. Devuelve true justo en el tick en que la cadena se cierra
   * por tiempo, para que quien llame pueda cantar el total una sola vez.
   */
  tick(dt: number): boolean {
    if (this._links <= 0) return false;
    this._remaining -= dt;
    if (this._remaining > 0) return false;
    this._links = 0;
    this._remaining = 0;
    return true;
  }
}
