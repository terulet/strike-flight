/**
 * feel-probe.ts
 *
 * Banco de pruebas de SENSACION, no de correccion. Los tests dicen si algo
 * esta roto; esto dice si algo se siente bien, que es de lo que iba el veto de
 * producto. Corre la simulacion sin navegador y saca los numeros que de otro
 * modo habria que adivinar a ojo:
 *
 * - cuanto tarda en llegar a 20 m/s desde parado y cuanto patina al salir;
 * - cuanto gira la rueda por metro recorrido (debe ser exactamente 1/R);
 * - cuanto se hunde la horquilla al frenar y cuanto se sienta al acelerar;
 * - si el circuito real se completa sin crash con un piloto automatico basico.
 *
 * Uso: npx tsx tools/feel-probe.ts   (o `npm run probe`)
 */

import { Terrain } from '../src/physics/Terrain';
import { BikeState, createInitialBikeState, isAirborne, stepBike } from '../src/physics/Bike';
import { InputSmoother } from '../src/input/InputSmoothing';
import { InputState } from '../src/input/InputManager';
import { BikeConfig, SIM_DT } from '../src/config/GameConfig';
import { buildCanyonRun } from '../src/tracks/CanyonRun';

function flatTerrain(): Terrain {
  return new Terrain([
    { x: -60, y: 0 },
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
  ]);
}

function raw(throttle: boolean, brake: boolean, lean = 0): InputState {
  return { throttle, brake, lean, restartPressed: false };
}

interface RunOptions {
  terrain: Terrain;
  seconds: number;
  startX?: number;
  startY?: number;
  input: (t: number, state: BikeState) => InputState;
  onTick?: (t: number, state: BikeState, previous: BikeState) => void;
}

function run(options: RunOptions): BikeState {
  const smoother = new InputSmoother();
  let state = createInitialBikeState(options.startX ?? 0, options.startY ?? 1.5);
  const steps = Math.round(options.seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * SIM_DT;
    const smoothed = smoother.update(options.input(t, state), SIM_DT);
    const previous = state;
    state = stepBike(state, options.terrain, { throttle: smoothed.throttle > 0.5, brake: smoothed.brake > 0.5, lean: smoothed.lean, smoothed }, SIM_DT);
    options.onTick?.(t, state, previous);
  }
  return state;
}

function fmt(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

console.log('=== SALIDA DESDE PARADO (gas a fondo, llano) ===');
{
  let timeTo20: number | null = null;
  let maxSlip = 0;
  let maxRearLoad = 0;
  let minFrontLoad = Infinity;
  let maxAngle = 0;
  let distance = 0;
  const final = run({
    terrain: flatTerrain(),
    seconds: 8,
    input: () => raw(true, false),
    onTick: (t, s) => {
      if (timeTo20 === null && s.vx >= 20) timeTo20 = t;
      maxSlip = Math.max(maxSlip, s.rear.wheel.slip);
      maxRearLoad = Math.max(maxRearLoad, s.rear.load);
      minFrontLoad = Math.min(minFrontLoad, s.front.load);
      maxAngle = Math.max(maxAngle, s.angle);
      distance = s.x;
    },
  });
  console.log(`  0 -> 20 m/s : ${timeTo20 === null ? 'NUNCA' : fmt(timeTo20) + ' s'}`);
  console.log(`  vx final    : ${fmt(final.vx)} m/s (distancia ${fmt(distance, 1)} m en 8 s)`);
  console.log(`  patinaje max: ${fmt(maxSlip)} m/s de la rueda trasera`);
  console.log(`  carga tras. max ${fmt(maxRearLoad, 0)} N / delantera min ${fmt(minFrontLoad, 0)} N`);
  console.log(`  cabeceo max : ${fmt(maxAngle, 3)} rad (${fmt((maxAngle * 180) / Math.PI, 1)} grados)`);
  console.log(`  giro rueda trasera final: ${fmt(final.rear.wheel.spinRate)} rad/s`);
}

console.log('\n=== GIRO DE RUEDA vs DISTANCIA (rodadura pura) ===');
{
  let totalSpin = 0;
  let distance = 0;
  const start = 0;
  run({
    terrain: flatTerrain(),
    seconds: 6,
    input: (t) => raw(t < 3, false),
    onTick: (_t, s, prev) => {
      let delta = s.front.wheel.spin - prev.front.wheel.spin;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      totalSpin += delta;
      distance = s.x - start;
    },
  });
  const expected = distance / BikeConfig.wheelRadius;
  console.log(`  distancia ${fmt(distance, 2)} m -> giro ${fmt(totalSpin, 2)} rad (esperado ${fmt(expected, 2)} rad)`);
  console.log(`  error relativo: ${fmt((100 * Math.abs(totalSpin - expected)) / Math.abs(expected), 2)} %`);
}

console.log('\n=== FRENADA A FONDO DESDE 25 m/s ===');
{
  let phase2FrontCompression = 0;
  let phase2RearCompression = 0;
  let cruiseFront = 0;
  let cruiseRear = 0;
  let minFrontSpin = Infinity;
  let minRearSpin = Infinity;
  let minRearCompression = Infinity;
  let maxRearSkid = 0;
  let stopTime: number | null = null;
  const brakeStart = 6;
  run({
    terrain: flatTerrain(),
    seconds: 9,
    input: (t) => (t < brakeStart ? raw(true, false) : raw(false, true)),
    onTick: (t, s) => {
      if (t > brakeStart - 0.4 && t < brakeStart) {
        cruiseFront = s.front.compression;
        cruiseRear = s.rear.compression;
      }
      if (t > brakeStart && t < brakeStart + 0.8) {
        phase2FrontCompression = Math.max(phase2FrontCompression, s.front.compression);
        phase2RearCompression = Math.max(phase2RearCompression, s.rear.compression);
        minFrontSpin = Math.min(minFrontSpin, s.front.wheel.spinRate);
        minRearSpin = Math.min(minRearSpin, s.rear.wheel.spinRate);
        minRearCompression = Math.min(minRearCompression, s.rear.compression);
        maxRearSkid = Math.max(maxRearSkid, -s.rear.wheel.slip);
      }
      if (stopTime === null && t > brakeStart && Math.abs(s.vx) < 0.5) stopTime = t - brakeStart;
    },
  });
  console.log(`  compresion delantera: crucero ${fmt(cruiseFront, 3)} -> frenando ${fmt(phase2FrontCompression, 3)} m`);
  console.log(`  compresion trasera  : crucero ${fmt(cruiseRear, 3)} -> frenando ${fmt(phase2RearCompression, 3)} m`);
  console.log(`  compresion trasera minima al frenar: ${fmt(minRearCompression, 3)} m (se extiende al descargarse)`);
  console.log(`  giro minimo rueda delantera al frenar: ${fmt(minFrontSpin, 2)} rad/s (0 = bloqueada, negativo = MAL)`);
  console.log(`  giro minimo rueda trasera al frenar  : ${fmt(minRearSpin, 2)} rad/s`);
  console.log(`  bloqueo trasero (deslizamiento negativo max): ${fmt(maxRearSkid, 2)} m/s`);
  console.log(`  parada completa en ${stopTime === null ? '>3 s' : fmt(stopTime) + ' s'}`);
}

console.log('\n=== TRANSFERENCIA DE PESO POR EL CUERPO (llano, velocidad constante) ===');
{
  for (const lean of [-1, 0, 1]) {
    let front = 0;
    let rear = 0;
    let samples = 0;
    run({
      terrain: flatTerrain(),
      seconds: 6,
      input: (t) => raw(true, false, t > 3 ? lean : 0),
      onTick: (t, s) => {
        if (t > 5) {
          front += s.front.load;
          rear += s.rear.load;
          samples += 1;
        }
      },
    });
    const label = lean < 0 ? 'delante' : lean > 0 ? 'atras  ' : 'neutro ';
    console.log(`  lean ${label}: carga delantera ${fmt(front / samples, 0)} N / trasera ${fmt(rear / samples, 0)} N`);
  }
}

console.log('\n=== CIRCUITO REAL (piloto automatico simple) ===');
{
  const track = buildCanyonRun();
  let state = createInitialBikeState(track.startX, track.startY);
  const smoother = new InputSmoother();
  let crashedAt: number | null = null;
  let maxX = state.x;
  let airTicks = 0;
  let finishTime: number | null = null;
  const steps = Math.round(90 / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * SIM_DT;
    const air = isAirborne(state);
    if (air) airTicks += 1;
    // Piloto automatico: gas a fondo, y en el aire corrige el cabeceo hacia
    // el nivel (lo que haria cualquiera que juegue medio despierto).
    const lean = air ? (state.angle > 0.12 ? 1 : state.angle < -0.12 ? -1 : 0) : 0;
    const smoothed = smoother.update(raw(true, false, lean), SIM_DT);
    state = stepBike(state, track.terrain, { throttle: true, brake: false, lean, smoothed }, SIM_DT);
    maxX = Math.max(maxX, state.x);
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) {
      crashedAt = t;
      break;
    }
    const groundY = track.terrain.surfaceY(state.x);
    if (state.y - groundY < -0.3) {
      crashedAt = t;
      break;
    }
    if (state.x >= track.finishX) {
      finishTime = t;
      break;
    }
  }
  console.log(`  avance maximo: ${fmt(maxX, 1)} m de ${fmt(track.finishX, 0)} m`);
  console.log(`  tiempo en el aire: ${fmt((airTicks * SIM_DT), 1)} s`);
  console.log(`  meta: ${finishTime === null ? 'NO' : fmt(finishTime) + ' s'}${crashedAt !== null ? ` (atravesado el suelo en t=${fmt(crashedAt)})` : ''}`);
}
