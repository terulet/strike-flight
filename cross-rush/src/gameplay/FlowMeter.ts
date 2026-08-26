/**
 * FlowMeter.ts
 *
 * Medidor de "flow" 0-100. Sube conduciendo bien (rapido con ruedas en el
 * suelo, o controlando rotaciones en el aire) y baja con aterrizajes malos o
 * el crash. Al llegar a 100 entra en REDLINE: un pequeno boost temporal de
 * velocidad y multiplicador de puntuacion.
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
    if (this._value >= FlowConfig.redlineThreshold && this.redlineTimer <= 0) {
      this.redlineTimer = FlowConfig.redlineDurationSeconds;
    }
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
