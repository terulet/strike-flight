import { describe, expect, it } from 'vitest';
import { buildCanyonRun, TerrainFeature } from '../src/tracks/CanyonRun';

function sampleExtents(feature: TerrainFeature): { minY: number; maxY: number } {
  const { terrain } = buildCanyonRun();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const x = feature.startX + ((feature.endX - feature.startX) * i) / 200;
    const y = terrain.surfaceY(x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minY, maxY };
}

describe('Corte vertical: aprendizaje y espectaculo', () => {
  it('coloca los doce obstaculos en orden y sin solaparse', () => {
    const track = buildCanyonRun();
    // whoops y rockgarden estuvieron CONGELADOS mientras se aprobaba la
    // conduccion basica. Ya no: entran en la recta de recuperacion, que era el
    // hueco muerto mas largo de la vuelta.
    //
    // Los seis ultimos son la ampliacion de la vuelta: la seccion de RITMO
    // (ondas + doble) despues del aterrizaje, el STEP_DOWN entre los peraltes
    // y el uphill, la chapa de lavar con pedregal detras de la linea de
    // riesgo, y la mesa de llegada. La lista va literal a proposito: es el
    // orden en el que se recorren, y si alguien mueve un tramo de sitio la
    // prueba lo dice en vez de dejarlo pasar.
    expect(track.terrainFeatures.map((feature) => feature.kind)).toEqual([
      'tabletop',
      'whoops',
      'rockgarden',
      'stepup',
      'dropoff',
      'tabletop',
      'whoops',
      'tabletop',
      'dropoff',
      'whoops',
      'rockgarden',
      'tabletop',
    ]);
    for (let i = 0; i < track.terrainFeatures.length; i++) {
      const feature = track.terrainFeatures[i];
      expect(feature.endX).toBeGreaterThan(feature.startX);
      if (i > 0) expect(feature.startX).toBeGreaterThanOrEqual(track.terrainFeatures[i - 1].endX);
    }
  });

  it('entre whoops y pedregal hay llano para respirar', () => {
    const track = buildCanyonRun();
    // Los del tramo de aprendizaje: los primeros de cada clase.
    const whoops = track.terrainFeatures.find((feature) => feature.kind === 'whoops')!;
    const rocks = track.terrainFeatures.find((feature) => feature.kind === 'rockgarden')!;
    // Encadenar dos secciones tecnicas sin respiro no ensena nada: solo
    // produce un choque que el jugador no ve venir.
    expect(rocks.startX - whoops.endX).toBeGreaterThan(10);
    for (let x = whoops.endX; x < rocks.startX; x += 0.5) {
      expect(Math.abs(track.terrain.surfaceSlope(x))).toBeLessThan(0.1);
    }
  });

  it('la vuelta se parte en dos: aprendizaje y espectaculo, sin huecos', () => {
    const track = buildCanyonRun();
    expect(track.sectors.map((sector) => sector.name)).toEqual(['APRENDIZAJE', 'ESPECTACULO']);
    expect(track.sectors[0].startX).toBe(0);
    expect(track.sectors[0].endX).toBe(track.sectors[1].startX);
    expect(track.sectors[1].endX).toBe(track.finishX);
    // El espectaculo empieza justo donde acaba de ensenarse a conducir.
    expect(track.sectors[1].startX).toBe(track.labels.find((label) => label.name === 'TECHNICAL')!.x);
  });

  it('tabletop tiene meseta y vuelve a su cota de entrada', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'tabletop')!; // el primero: el del tramo de aprendizaje
    const startY = track.terrain.surfaceY(feature.startX);
    expect(sampleExtents(feature).maxY).toBeGreaterThan(startY + 2.8);
    // Meseta de verdad: en el punto medio el terreno es plano, asi que
    // quedarse corto cae ENCIMA de la mesa y no en un hueco.
    expect(Math.abs(track.terrain.surfaceSlope((feature.startX + feature.endX) / 2))).toBeLessThan(0.08);
    expect(track.terrain.surfaceY(feature.endX)).toBeCloseTo(startY, 5);
  });

  it('step-up termina claramente por encima de su entrada, con hueco en medio', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'stepup')!;
    expect(track.terrain.surfaceY(feature.endX)).toBeGreaterThan(track.terrain.surfaceY(feature.startX) + 3.5);
    // El valle entre despegue y aterrizaje existe: si no, seria una rampa.
    expect(track.terrain.surfaceY(feature.startX + 15)).toBeLessThan(track.terrain.surfaceY(feature.startX + 11));
  });

  it('la bajada termina en una cota bastante inferior', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'dropoff')!;
    expect(track.terrain.surfaceY(feature.startX) - track.terrain.surfaceY(feature.endX)).toBeGreaterThan(6);
  });

  it('la compresion inicial es una vaguada suave, no un bache', () => {
    const track = buildCanyonRun();
    const compression = track.labels.find((label) => label.name === 'COMPRESSION')!;
    const entryY = track.terrain.surfaceY(compression.x);
    const bottomY = track.terrain.surfaceY(compression.x + 12);
    expect(entryY - bottomY).toBeGreaterThan(1.2);
    // Suave: en ningun punto de la bajada la pendiente pasa de ~11 grados.
    for (let x = compression.x; x < compression.x + 24; x += 0.5) {
      expect(Math.abs(track.terrain.surfaceSlope(x))).toBeLessThan(0.2);
    }
  });

  it('el terreno es continuo y no tiene ninguna cuesta imposible', () => {
    const track = buildCanyonRun();
    const STEP = 0.25;
    let steepest = 0;
    let steepRun = 0;
    let longestSteepRun = 0;

    for (let x = track.terrain.startX; x < track.terrain.endX; x += STEP) {
      const slope = Math.abs(track.terrain.surfaceSlope(x));
      expect(Number.isFinite(slope)).toBe(true);
      steepest = Math.max(steepest, slope);
      // Tramo CONTINUO por encima de 45 grados. Se mide asi, y no punto a
      // punto, porque las dos cosas son distintas: una cuesta de 45 grados
      // que dura metros no la sube ni la baja nadie, mientras que el labio de
      // un kicker es una arista y tiene que ser afilada -es justo lo que
      // lanza la moto al aire-. La curva del terreno es un spline, asi que en
      // esas aristas se pasa medio metro por encima del limite; penalizarlo
      // seria pedir kickers redondeados, o sea, sin salto.
      steepRun = slope > 1 ? steepRun + STEP : 0;
      longestSteepRun = Math.max(longestSteepRun, steepRun);
    }

    expect(steepest).toBeLessThan(1.43); // nada llega a 55 grados
    expect(longestSteepRun).toBeLessThan(1.2); // y lo que pasa de 45 dura menos de un metro
  });
});
