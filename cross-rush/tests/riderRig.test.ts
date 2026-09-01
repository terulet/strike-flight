/**
 * El piloto tiene que ir MONTADO en la moto, no pegado encima.
 *
 * Esta prueba existe por un fallo que sobrevivio a varias rondas de revision
 * visual porque nadie lo estaba midiendo: la cadera del piloto estaba anclada
 * 20 cm por debajo del asiento -dentro del motor- y la estribera 17 cm por
 * encima de donde la pone el arte. Entre las dos, la cadera acababa a 6 cm del
 * tobillo con 52 cm de pierna que colocar, asi que la cinematica inversa no
 * tenia mas remedio que plegarla del todo: la rodilla salia a 7 grados y el
 * muslo, la espinilla y la bota se amontonaban en una mancha sobre el
 * carenado. Peor todavia, el brazo se quedaba corto y las manos se despegaban
 * del manillar en dos de cada tres fotogramas.
 *
 * Nada de eso rompia un test ni un tipo. Se veia, y punto. De ahi que lo que
 * se comprueba aqui sea justo lo que se veia mal.
 */
import { describe, expect, it } from 'vitest';
import { BikeState, createInitialBikeState, stepBike } from '../src/physics/Bike';
import { InputSmoother } from '../src/input/InputSmoothing';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { RiderConfig, SIM_DT } from '../src/config/GameConfig';

// SpriteAssets construye HTMLImageElement al cargarse, que en node no existe.
// El rig no los usa para resolver la postura -solo para dibujarla-, asi que un
// doble minimo basta para poder importar el modulo y medir la geometria.
(globalThis as unknown as { Image: unknown }).Image = class {
  src = '';
  naturalWidth = 1;
  naturalHeight = 1;
};

const { solveRiderRig, HANDLEBAR_GRIP_LOCAL, FOOTPEG_LOCAL } = await import('../src/rendering/RiderRig');
const { SpriteCalibration } = await import('../src/rendering/SpriteAssets');

const rig = SpriteCalibration.riderRig;
const legReach = (rig.thigh.lengthPx + rig.shin.lengthPx) / rig.pxPerMeter;
const armReach = (rig.armUpper.lengthPx + rig.armFore.lengthPx) / rig.pxPerMeter;

/** El tobillo apunta un poco por encima de la estribera (ver RiderRig). */
const ANKLE_OVER_PEG = { x: -0.02, y: 0.1 };

function pose(shiftX: number, shiftY: number, torsoAngle: number) {
  return { shiftX, shiftY, torsoAngle, shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angulo interior de la rodilla en grados: 180 es pierna estirada. */
function kneeDegrees(hipToAnkle: number): number {
  const t = rig.thigh.lengthPx / rig.pxPerMeter;
  const s = rig.shin.lengthPx / rig.pxPerMeter;
  const d = Math.min(hipToAnkle, t + s);
  const cos = (t * t + s * s - d * d) / (2 * t * s);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/**
 * Poses REALES, no un barrido sobre la caja de topes.
 *
 * El primer intento de esta prueba recorria el rectangulo completo
 * (maxShiftX x maxShiftY x maxTorsoAngle) y suspendia con cualquier anclaje:
 * sus esquinas -cuerpo del todo atras Y del todo agachado Y con el torso
 * girado al maximo- no ocurren jamas, porque las tres cosas las produce la
 * misma fisica y van acopladas. Medir sobre poses imposibles habria obligado a
 * elegir anclajes malos para las de verdad.
 *
 * Asi que se conduce: la moto rueda a gas por la pista de verdad, salta lo que
 * tenga que saltar, y se mide el rig sobre la pose que sale de cada tick.
 */
function posesDeUnaVuelta(): Array<{ hipToAnkle: number; shoulderToGrip: number }> {
  const track = buildCanyonRun();
  let state: BikeState = createInitialBikeState(track.startX, track.terrain.surfaceY(track.startX) + 0.6);
  const smoother = new InputSmoother();
  const out: Array<{ hipToAnkle: number; shoulderToGrip: number }> = [];
  const ankle = { x: FOOTPEG_LOCAL.x + ANKLE_OVER_PEG.x, y: FOOTPEG_LOCAL.y + ANKLE_OVER_PEG.y };
  const ticks = Math.round(45 / SIM_DT);
  for (let i = 0; i < ticks; i += 1) {
    // Se pilota igual que el arnes de captura: gas a fondo y el cuerpo
    // buscando la pendiente que viene mientras se vuela.
    const air = !state.front.inContact && !state.rear.inContact;
    let lean = 0;
    if (air) {
      const ahead = state.x + Math.max(2, Math.abs(state.vx) * 0.32);
      const target = Math.atan(track.terrain.surfaceSlope(ahead));
      let delta = target - state.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta <= -Math.PI) delta += Math.PI * 2;
      const want = delta * 2.2 - state.angularVelocity * 0.42;
      lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
    }
    const smoothed = smoother.update(
      { throttle: true, brake: false, lean, restartPressed: false, boostPressed: false },
      SIM_DT,
    );
    state = stepBike(state, track.terrain, { throttle: true, brake: false, lean: smoothed.lean, smoothed }, SIM_DT);
    const g = solveRiderRig({ x: state.x, y: state.y }, state.angle, state.rider, 100);
    // El rig se resuelve en mundo; para medir alcances se compara contra los
    // agarres llevados al mismo espacio.
    const cos = Math.cos(state.angle);
    const sin = Math.sin(state.angle);
    const toWorld = (p: { x: number; y: number }) => ({
      x: state.x + p.x * cos - p.y * sin,
      y: state.y + p.x * sin + p.y * cos,
    });
    out.push({
      hipToAnkle: distance(g.hipWorld, toWorld(ankle)),
      shoulderToGrip: distance(g.shoulderWorld, toWorld(HANDLEBAR_GRIP_LOCAL)),
    });
    if (state.x > track.finishX) break;
  }
  return out;
}

describe('anclajes del piloto', () => {
  it('la estribera esta donde la pone el arte de la moto, no dentro del motor', () => {
    // Pixel (370, 330) de bike_body.png, con el centro de masas en
    // (341.7, 176.3) y la foto a 347 px/m.
    expect(FOOTPEG_LOCAL.x).toBeCloseTo((370 - 341.7) / 347, 2);
    expect(FOOTPEG_LOCAL.y).toBeCloseTo(-(330 - 176.3) / 347, 2);
  });

  it('sentado en reposo la rodilla va franca, no plegada', () => {
    const g = solveRiderRig({ x: 0, y: 0 }, 0, pose(0, 0, 0), 100);
    const ankle = { x: FOOTPEG_LOCAL.x + ANKLE_OVER_PEG.x, y: FOOTPEG_LOCAL.y + ANKLE_OVER_PEG.y };
    const knee = kneeDegrees(distance(g.hipWorld, ankle));
    // Un piloto sentado en una moto de cross lleva la rodilla cerca de 90
    // grados. Con los anclajes viejos salian 7.
    expect(knee).toBeGreaterThan(70);
    expect(knee).toBeLessThan(115);
  });

  it('el pie se queda en la estribera durante toda la vuelta', () => {
    const muestras = posesDeUnaVuelta();
    expect(muestras.length).toBeGreaterThan(2000);
    const fuera = muestras.filter((s) => s.hipToAnkle > legReach);
    // Solo se admite despegue en el pico de extension de un salto grande.
    expect(fuera.length / muestras.length).toBeLessThan(0.08);
  });

  it('las manos se quedan en el manillar durante toda la vuelta', () => {
    const muestras = posesDeUnaVuelta();
    const fuera = muestras.filter((s) => s.shoulderToGrip > armReach);
    // Con los anclajes viejos se despegaban en DOS DE CADA TRES fotogramas.
    expect(fuera.length / muestras.length).toBeLessThan(0.08);
  });

  it('la pierna trabaja: se dobla y se estira a lo largo de la vuelta', () => {
    const rodillas = posesDeUnaVuelta().map((s) => kneeDegrees(s.hipToAnkle));
    const min = Math.min(...rodillas);
    const max = Math.max(...rodillas);
    // Antes iba de 0 a 70 grados: siempre plegada, sin recorrido util.
    expect(min).toBeGreaterThan(55);
    expect(max - min).toBeGreaterThan(50);
  });

  it('el piloto tiene medidas de adulto sobre esta moto', () => {
    const hipToHelmet = 226.9 / rig.pxPerMeter;
    // Cadera a coronilla de un adulto: 0,80-0,95 m. Con 300 px/m salian 0,76.
    expect(hipToHelmet).toBeGreaterThan(0.8);
    expect(hipToHelmet).toBeLessThan(0.95);
    // Y las extremidades tienen que dar mas de si que el recorrido del cuerpo.
    expect(legReach).toBeGreaterThan(2 * RiderConfig.maxShiftY);
    expect(armReach).toBeGreaterThan(RiderConfig.maxShiftY);
  });
});
