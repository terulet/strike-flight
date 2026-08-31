/**
 * DebugOverlay.ts
 *
 * Panel de depuracion (toggle con F1 o `~`) con FPS, ticks de sim, velocidad,
 * angulo/velocidad angular, contacto de ruedas, compresion de suspension,
 * FLOW, sector y tiempo de carrera.
 */

import { BikeState } from '../physics/Bike';

export interface DebugSnapshot {
  fps: number;
  simTicksLastFrame: number;
  bike: BikeState;
  flow: number;
  sector: string;
  raceTime: number;
  gameState: string;
}

export class DebugOverlay {
  private readonly el: HTMLElement;
  visible = false;

  constructor(container: HTMLElement) {
    this.el = document.createElement('pre');
    this.el.style.position = 'absolute';
    this.el.style.top = '8px';
    this.el.style.left = '8px';
    this.el.style.margin = '0';
    this.el.style.padding = '8px 10px';
    this.el.style.background = 'rgba(0,0,0,0.55)';
    this.el.style.color = '#7CFC7C';
    this.el.style.fontFamily = 'monospace';
    this.el.style.fontSize = '12px';
    this.el.style.lineHeight = '1.4';
    this.el.style.borderRadius = '6px';
    this.el.style.pointerEvents = 'none';
    this.el.style.display = 'none';
    container.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  update(snap: DebugSnapshot): void {
    if (!this.visible) return;
    const b = snap.bike;
    this.el.textContent = [
      `FPS: ${snap.fps.toFixed(0)}  ticks/frame: ${snap.simTicksLastFrame}`,
      `state: ${snap.gameState}  sector: ${snap.sector}  t: ${snap.raceTime.toFixed(2)}s`,
      `pos: (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`,
      `vel: (${b.vx.toFixed(2)}, ${b.vy.toFixed(2)})  |v|: ${Math.hypot(b.vx, b.vy).toFixed(2)}`,
      `angle: ${((b.angle * 180) / Math.PI).toFixed(1)} deg  angVel: ${b.angularVelocity.toFixed(2)} rad/s`,
      `front: contact=${b.front.inContact} comp=${b.front.compression.toFixed(3)}`,
      `rear:  contact=${b.rear.inContact} comp=${b.rear.compression.toFixed(3)}`,
      `flow: ${snap.flow.toFixed(1)}`,
    ].join('\n');
  }
}
