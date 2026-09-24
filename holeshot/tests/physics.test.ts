import { describe, expect, it } from 'vitest';
import { BIKE, BikeState, createBike, isAirborne, stepBike } from '../src/physics/bike';
import { TrackBuilder } from '../src/physics/trackBuilder';
import { DT, flatTerrain } from './helpers';

const idle = { throttle: 0, brake: 0, lean: 0, nitro: false };
const finite = (b: BikeState): boolean =>
  [b.x, b.y, b.vx, b.vy, b.angle, b.omega, b.rear.comp, b.front.comp, b.rear.spinRate, b.front.spinRate].every(Number.isFinite);

describe('moto', () => {
  it('se queda quieta y nivelada en llano, con las dos ruedas apoyadas', () => {
    const terrain = flatTerrain();
    const b = createBike(terrain, 50);
    for (let t = 0; t < 4; t += DT) stepBike(b, idle, terrain, DT);
    expect(finite(b)).toBe(true);
    expect(Math.abs(b.angle)).toBeLessThan(0.03);
    expect(Math.abs(b.vx)).toBeLessThan(0.05);
    expect(b.rear.inContact && b.front.inContact).toBe(true);
    // Hundimiento estatico razonable: ni tope ni suspension muerta.
    expect(b.rear.comp).toBeGreaterThan(0.04);
    expect(b.rear.comp).toBeLessThan(BIKE.travel * 0.6);
  });

  it('las ruedas giran a la velocidad del suelo (rodadura sin patinar)', () => {
    const terrain = flatTerrain(600);
    const b = createBike(terrain, 20);
    for (let t = 0; t < 3; t += DT) stepBike(b, { ...idle, throttle: 1, lean: -0.2 }, terrain, DT);
    for (let t = 0; t < 1; t += DT) stepBike(b, idle, terrain, DT);
    expect(b.vx).toBeGreaterThan(10);
    const rim = b.front.spinRate * BIKE.wheelRadius;
    expect(Math.abs(rim - b.vx) / b.vx).toBeLessThan(0.08);
    expect(Math.abs(b.rear.spinRate * BIKE.wheelRadius - b.vx) / b.vx).toBeLessThan(0.08);
    // El giro acumulado avanza: la rueda se ve girar.
    expect(b.front.spin).toBeGreaterThan(20);
  });

  it('el gas a fondo desde parado hace patinar la trasera y levanta el morro', () => {
    const terrain = flatTerrain();
    const b = createBike(terrain, 20);
    for (let t = 0; t < 1; t += DT) stepBike(b, idle, terrain, DT);
    let maxSlip = 0;
    let maxPitch = 0;
    for (let t = 0; t < 1.2; t += DT) {
      stepBike(b, { ...idle, throttle: 1, lean: 1 }, terrain, DT);
      maxSlip = Math.max(maxSlip, -b.rear.slip);
      maxPitch = Math.max(maxPitch, b.angle);
    }
    expect(maxSlip).toBeGreaterThan(0.3);
    expect(maxPitch).toBeGreaterThan(0.15);
    // Pero la ayuda evita darse la vuelta.
    expect(maxPitch).toBeLessThan(1.3);
  });

  it('frenar fuerte hunde la horquilla', () => {
    const terrain = flatTerrain(600);
    const b = createBike(terrain, 20);
    for (let t = 0; t < 2.5; t += DT) stepBike(b, { ...idle, throttle: 1 }, terrain, DT);
    const cruiseFront = b.front.comp;
    let maxFront = 0;
    let minAngle = 0;
    for (let t = 0; t < 0.8; t += DT) {
      stepBike(b, { ...idle, brake: 1 }, terrain, DT);
      maxFront = Math.max(maxFront, b.front.comp);
      minAngle = Math.min(minAngle, b.angle);
    }
    expect(maxFront).toBeGreaterThan(cruiseFront + 0.03);
    expect(minAngle).toBeLessThan(-0.01);
  });

  it('la suspension absorbe una caida de 3 m sin atravesar el suelo', () => {
    const terrain = flatTerrain();
    const b = createBike(terrain, 50);
    b.y += 3;
    let maxComp = 0;
    let lowest = Infinity;
    for (let t = 0; t < 3; t += DT) {
      stepBike(b, idle, terrain, DT);
      maxComp = Math.max(maxComp, b.rear.comp, b.front.comp);
      lowest = Math.min(lowest, b.y - terrain.heightAt(b.x));
    }
    expect(maxComp).toBeGreaterThan(0.15);
    expect(lowest).toBeGreaterThan(0.2);
    expect(b.rear.inContact && b.front.inContact).toBe(true);
    expect(Math.abs(b.angle)).toBeLessThan(0.05);
  });

  it('en el aire el cuerpo hace girar la moto (mortal hacia atras posible)', () => {
    const terrain = flatTerrain();
    const b = createBike(terrain, 50);
    b.y += 40;
    b.vx = 10;
    let rot = 0;
    let prev = b.angle;
    for (let t = 0; t < 1.5 && isAirborne(b); t += DT) {
      stepBike(b, { ...idle, lean: 1 }, terrain, DT);
      rot += b.angle - prev;
      prev = b.angle;
    }
    expect(rot).toBeGreaterThan(Math.PI * 2 * 0.9);
  });

  it('en el barro la moto corre menos que en tierra', () => {
    const top = (withMud: boolean): number => {
      const t = new TrackBuilder().flat(40);
      if (withMud) t.mud(300);
      else t.flat(300);
      const terrain = t.flat(20).build(5, 5).terrain;
      const b = createBike(terrain, 42);
      b.vx = 20;
      for (let s = 0; s < 6; s += DT) stepBike(b, { ...idle, throttle: 1 }, terrain, DT);
      return b.vx;
    };
    const dry = top(false);
    const wet = top(true);
    expect(wet).toBeLessThan(dry - 3);
    expect(wet).toBeGreaterThan(10);
  });

  it('nunca produce NaN ni velocidades absurdas con mandos aleatorios por una pista dura', () => {
    const t = new TrackBuilder().flat(20).whoops(8, 0.9, 5).kicker(8, 3).gap(16, 6, -1).landing(12, 2).rocks(20, 8, 0.5).logs(3, 4).stepUp(2).dropOff(3).flat(40);
    const terrain = t.build(5, 10).terrain;
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let run = 0; run < 6; run++) {
      const b = createBike(terrain, 6);
      let input = idle;
      for (let s = 0; s < 20; s += DT) {
        if (rnd() < 0.02) input = { throttle: rnd() < 0.7 ? 1 : 0, brake: rnd() < 0.15 ? 1 : 0, lean: Math.round(rnd() * 2 - 1), nitro: rnd() < 0.2 };
        stepBike(b, input, terrain, DT);
        expect(finite(b)).toBe(true);
      }
      expect(Math.abs(b.vx)).toBeLessThanOrEqual(60);
    }
  });
});
