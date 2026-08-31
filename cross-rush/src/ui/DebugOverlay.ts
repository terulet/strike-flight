/**
 * DebugOverlay.ts
 *
 * Panel de depuracion (toggle con F1 o `~`) con FPS, ticks de sim, velocidad,
 * angulo/velocidad angular, estado completo de cada rueda -giro, deslizamiento,
 * carga, compresion-, pose del piloto, FLOW, sector y tiempo de carrera.
 *
 * El bloque de ruedas y el de piloto son la prueba a pie de pantalla de que
 * el modelo esta vivo: el angulo de rueda avanza con el recorrido, el
 * deslizamiento se dispara al patinar y se vuelve negativo al bloquearse, la
 * carga se mueve de un eje al otro con el gas y el freno, y la pose del
 * piloto se sale de cero en cuanto el jugador toca algo.
 */

import { BikeState, engineRpmRatio, normalizedAxleLoad } from '../physics/Bike';

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
      `front: contact=${b.front.inContact ? 1 : 0} comp=${b.front.compression.toFixed(3)} carga=${normalizedAxleLoad(b, 'front').toFixed(2)}`,
      `  rueda: ${((b.front.wheel.spin * 180) / Math.PI).toFixed(0).padStart(4)} deg  ${b.front.wheel.spinRate.toFixed(1).padStart(6)} rad/s  slip ${b.front.wheel.slip.toFixed(2)}`,
      `rear:  contact=${b.rear.inContact ? 1 : 0} comp=${b.rear.compression.toFixed(3)} carga=${normalizedAxleLoad(b, 'rear').toFixed(2)}`,
      `  rueda: ${((b.rear.wheel.spin * 180) / Math.PI).toFixed(0).padStart(4)} deg  ${b.rear.wheel.spinRate.toFixed(1).padStart(6)} rad/s  slip ${b.rear.wheel.slip.toFixed(2)}`,
      `motor: rpm ${(engineRpmRatio(b) * 100).toFixed(0)}%  gas ${(b.throttleAmount * 100).toFixed(0)}%  freno ${(b.brakeAmount * 100).toFixed(0)}%  lean ${b.leanAmount.toFixed(2)}`,
      `piloto: dx ${b.rider.shiftX.toFixed(3)} dy ${b.rider.shiftY.toFixed(3)} torso ${((b.rider.torsoAngle * 180) / Math.PI).toFixed(1)} deg`,
      `flow: ${snap.flow.toFixed(1)}`,
    ].join('\n');
  }
}
