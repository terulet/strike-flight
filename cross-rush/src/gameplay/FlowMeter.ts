/**
 * FlowMeter.ts
 *
 * Medidor de "flow" 0-100. Sube conduciendo bien (rapido con ruedas en el
 * suelo, o controlando rotaciones en el aire) y baja con aterrizajes malos o
 * el crash.
 *
 * Al llegar a 100 NO entra en REDLINE: queda ARMADO, y es el jugador quien
 * decide cuando gastarlo. Antes se disparaba solo, y eso lo convertia en algo
 * que te pasaba en vez de algo que haces: el turbo saltaba a mitad de una
 * recta cualquiera y se apagaba antes del salto grande. Gastandolo a mano, la
 * pregunta pasa a ser "¿me lo guardo para el mega salto o lo uso ya?", que es
 * una decision de verdad y ademas la que hace que el salto grande sea
 * espectacular cuando se acierta.
 */

import { clamp } from '../physics/MathUtils';
import { FlowConfig } from '../config/GameConfig';
import { LandingQuality } from './types';

export class FlowMeter {
  private _value = 0;
  private redlineTimer = 0;

  get value(): number {
    return this._value;
  }

  get isRedline(): boolean {
    return this.redlineTimer > 0;
  }

  get boostMultiplier(): number {
    return this.isRedline ? FlowConfig.redlineBoostMultiplier : 1;
  }

  get scoreMultiplier(): number {
    return this.isRedline ? FlowConfig.redlineScoreMultiplier : 1;
  }

  reset(): void {
    this._value = 0;
    this.redlineTimer = 0;
  }

  private add(amount: number): void {
    this._value = clamp(this._value + amount, FlowConfig.min, FlowConfig.max);
  }

  /** true cuando hay FLOW suficiente para gastar y no hay un turbo en curso. */
  get isBoostReady(): boolean {
    return this._value >= FlowConfig.redlineThreshold && this.redlineTimer <= 0;
  }

  /**
   * Gasta el FLOW cargado y arranca el REDLINE. Devuelve false -y no consume
   * nada- si no habia turbo listo, para que quien llame pueda distinguir un
   * disparo real de un botonazo en balde.
   */
  fireBoost(): boolean {
    if (!this.isBoostReady) return false;
    this.redlineTimer = FlowConfig.redlineDurationSeconds;
    this._value = FlowConfig.min;
    return true;
  }

  tick(dt: number, opts: { groundedFast: boolean; airControlActive: boolean }): void {
    if (this.redlineTimer > 0) {
      this.redlineTimer = Math.max(0, this.redlineTimer - dt);
    }
    let delta = -FlowConfig.passiveDecay * dt;
    if (opts.groundedFast) delta += FlowConfig.gainGroundedFast * dt;
    if (opts.airControlActive) delta += FlowConfig.gainAirControl * dt;
    this.add(delta);
  }

  onLanding(quality: LandingQuality): void {
    this.add(FlowConfig.landingBonus[quality]);
    if (quality === 'CRASH') this.redlineTimer = 0;
  }

  onTrick(): void {
    this.add(FlowConfig.trickBonus);
  }

  /** Bonus generico de FLOW (piezas de riesgo/recompensa: speed_pad, risk_gap, flow_ring). */
  bonus(amount: number): void {
    this.add(amount);
  }

  /** Alarga el REDLINE en curso, o lo concede si aun no se habia alcanzado (flow_ring bien atravesado). */
  extendRedline(seconds: number): void {
    this.redlineTimer = Math.max(this.redlineTimer, seconds);
  }
}
