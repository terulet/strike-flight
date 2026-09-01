/**
 * El ensamblaje, sobre las DIECISEIS poses canonicas.
 *
 * Estas comprobaciones existen por un defecto que el usuario vio y que ningun
 * test cazaba: "el piloto parece pegado a la moto; cuando se levanta la rueda,
 * el piloto se mueve sin acompanar correctamente a la moto". Medido sobre el
 * banco, en caballito fuerte la mano acababa a 29,2 cm del manillar y el pie a
 * 9,6 cm de la estribera, porque cuando la cadena no llegaba la cinematica
 * inversa se rendia y estiraba el brazo apuntando al puno desde lejos.
 *
 * Las poses son las mismas que dibuja `rig-check.html` y salen del sistema de
 * pose real, no de numeros escritos a mano: si alguien rompe la animacion, el
 * banco visual y estas pruebas se enteran a la vez.
 */
import { describe, expect, it } from 'vitest';
import { RIG_POSES } from '../src/tools/RigPoseCatalog';
import { measureRig } from './support/rigMetrics';
import { solveRiderRig } from '../src/rendering/RiderRig';

const medidas = RIG_POSES.map((pose) => ({ label: pose.label, m: measureRig(pose.bike) }));

/** Tolerancia del mandato para los dos anclajes. */
const TOLERANCIA = 0.03;

describe('anclajes del piloto en las 16 poses', () => {
  it('la mano no se despega del manillar en ninguna pose', () => {
    for (const { label, m } of medidas) {
      expect(m.handToGrip, `${label}: mano a ${(m.handToGrip * 100).toFixed(1)} cm del manillar`).toBeLessThan(TOLERANCIA);
    }
  });

  it('el pie no se despega de la estribera en ninguna pose', () => {
    for (const { label, m } of medidas) {
      expect(m.footToPeg, `${label}: pie a ${(m.footToPeg * 100).toFixed(1)} cm de la estribera`).toBeLessThan(TOLERANCIA);
    }
  });

  it('la cadera se queda dentro del asiento', () => {
    // El asiento de este arte va de x = -0,40 a x = +0,06 en espacio de chasis.
    // Con la pose sin recortar la cadera se iba a -0,58, o sea 23 cm por
    // detras del final del asiento, sentada sobre la rueda trasera.
    for (const { label, m } of medidas) {
      expect(m.hipLocal.x, `${label}: cadera en x=${m.hipLocal.x.toFixed(2)}`).toBeGreaterThan(-0.42);
      expect(m.hipLocal.x, `${label}: cadera en x=${m.hipLocal.x.toFixed(2)}`).toBeLessThan(0.1);
      expect(m.hipLocal.y, `${label}: cadera en y=${m.hipLocal.y.toFixed(2)}`).toBeGreaterThan(-0.3);
      expect(m.hipLocal.y, `${label}: cadera en y=${m.hipLocal.y.toFixed(2)}`).toBeLessThan(0.3);
    }
  });

  it('ninguna articulacion queda estirada del todo ni plegada del todo', () => {
    // 180 grados es la cadena rendida y 0 es la navaja cerrada: las dos se ven
    // como un palo. Antes habia cuatro poses con el codo exactamente a 180.
    for (const { label, m } of medidas) {
      expect(m.kneeDegrees, `${label}: rodilla a ${m.kneeDegrees.toFixed(0)} grados`).toBeGreaterThan(35);
      expect(m.kneeDegrees, `${label}: rodilla a ${m.kneeDegrees.toFixed(0)} grados`).toBeLessThan(175);
      expect(m.elbowDegrees, `${label}: codo a ${m.elbowDegrees.toFixed(0)} grados`).toBeGreaterThan(35);
      expect(m.elbowDegrees, `${label}: codo a ${m.elbowDegrees.toFixed(0)} grados`).toBeLessThan(175);
    }
  });

  it('el torso NO copia el cabeceo entero del chasis', () => {
    // Este es el defecto que el usuario describio. Con el torso pegado al
    // chasis el cociente vale 1 exacto y el piloto gira como una pegatina; en
    // caballito llegaba a 1,25, o sea que giraba MAS que la moto.
    const conCabeceo = medidas.filter((x) => x.m.torsoFollowsChassis !== null);
    expect(conCabeceo.length).toBeGreaterThan(3);
    for (const { label, m } of conCabeceo) {
      expect(m.torsoFollowsChassis!, `${label}: el torso sigue al chasis al ${(m.torsoFollowsChassis! * 100).toFixed(0)}%`).toBeLessThan(0.95);
    }
  });

  it('pero SIGUE al chasis: el piloto va montado, no flotando al lado', () => {
    // El otro extremo tambien esta mal. Un piloto desacoplado del todo parece
    // ir en paralelo a la moto en vez de encima de ella.
    const caballito = medidas.filter((x) => x.label.includes('CABALLITO'));
    expect(caballito.length).toBe(2);
    for (const { label, m } of caballito) {
      expect(m.torsoFollowsChassis!, `${label}`).toBeGreaterThan(0.3);
    }
  });

  it('ninguna pose produce NaN ni Infinity', () => {
    for (const pose of RIG_POSES) {
      const g = solveRiderRig({ x: pose.bike.x, y: pose.bike.y }, pose.bike.angle, pose.bike.rider, 100);
      const numeros = [
        g.hipWorld.x, g.hipWorld.y, g.shoulderWorld.x, g.shoulderWorld.y,
        g.arm.rootAngle, g.arm.midAngle, g.leg.rootAngle, g.leg.midAngle,
        g.farLeg.rootAngle, g.torsoWorldAngle, g.scale,
      ];
      for (const n of numeros) expect(Number.isFinite(n), pose.label).toBe(true);
    }
  });

  it('la transicion entre poses vecinas no da saltos', () => {
    // Se interpola la pose del piloto entre cada dos poses consecutivas y se
    // mide cuanto se mueve la cadera por paso. Un salto aqui seria un
    // fotograma en el que el cuerpo aparece en otro sitio.
    for (let i = 1; i < RIG_POSES.length; i += 1) {
      const a = RIG_POSES[i - 1].bike;
      const b = RIG_POSES[i].bike;
      let previous: { x: number; y: number } | null = null;
      let mayor = 0;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const mix = (p: number, q: number) => p + (q - p) * t;
        const g = solveRiderRig(
          { x: mix(a.x, b.x), y: mix(a.y, b.y) },
          mix(a.angle, b.angle),
          {
            shiftX: mix(a.rider.shiftX, b.rider.shiftX),
            shiftY: mix(a.rider.shiftY, b.rider.shiftY),
            torsoAngle: mix(a.rider.torsoAngle, b.rider.torsoAngle),
            shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0,
          },
          100,
        );
        if (previous) mayor = Math.max(mayor, Math.hypot(g.hipWorld.x - previous.x, g.hipWorld.y - previous.y));
        previous = g.hipWorld;
      }
      // Cada paso es un veinteavo del camino entre dos poses muy distintas,
      // asi que un salto de mas de 25 cm en un paso es una discontinuidad.
      expect(mayor, `${RIG_POSES[i - 1].label} -> ${RIG_POSES[i].label}`).toBeLessThan(0.25);
    }
  });
});

describe('el piloto y la caida', () => {
  it('sigue montado justo tras el impacto y separado despues', () => {
    const montado = RIG_POSES.find((p) => p.label.includes('AUN montado'))!;
    const separado = RIG_POSES.find((p) => p.label.includes('separado'))!;
    expect(montado.crashed).toBe(true);
    expect(separado.crashed).toBe(true);
    // El retraso de separacion lo decide CrashConfig.riderDetachDelay (0,25 s).
    expect(montado.crashElapsed!).toBeLessThan(0.25);
    expect(separado.crashElapsed!).toBeGreaterThan(0.25);
    // Y mientras sigue montado, sus anclajes tienen que aguantar.
    const m = measureRig(montado.bike);
    expect(m.handToGrip).toBeLessThan(TOLERANCIA);
    expect(m.footToPeg).toBeLessThan(TOLERANCIA);
  });
});
