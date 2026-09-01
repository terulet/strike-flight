/**
 * ComboMeter.ts
 *
 * Cadena de acrobacias. Cada cosa que puntua -un aterrizaje clavado, un
 * mortal, un aro, saltar el hueco- suma un eslabon y reinicia una cuenta
 * atras; si pasan `windowSeconds` sin nada, la cadena se cierra. Un choque la
 * rompe en el acto.
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

  /** 0..1, para dibujar la barra que se vacia. */
  get remainingFraction(): number {
    return ComboConfig.windowSeconds > 0 ? this._remaining / ComboConfig.windowSeconds : 0;
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
    this._remaining = ComboConfig.windowSeconds;
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
