/**
 * CanyonRun.ts
 *
 * VERTICAL SLICE: un tramo corto y repetible, con tres obstaculos y nada mas.
 *
 * El mandato congela whoops, rockgarden, ghost, delta avanzado y sectores
 * hasta que la sensacion basica de conducir este aprobada, y pide un tramo de
 * 30-45 s con un ritmo concreto. Este es ese tramo:
 *
 *   1. SALIDA        recta para acelerar de 0 a tope y notar la traccion.
 *   2. COMPRESION    una vaguada suave que hunde la suspension antes de nada.
 *                    Ensena que la moto tiene muelles sin castigar por ello.
 *   3. TABLETOP      el primer salto. Mesa: si te quedas corto caes ENCIMA,
 *                    no en un hueco. Es el salto que se aprende sin miedo.
 *   4. RECUPERACION  recta larga con un par de ondulaciones. Sitio para
 *                    recolocarse, mirar adelante y volver a coger velocidad.
 *   5. STEP_UP       subir a una plataforma mas alta. Exige llegar rapido y
 *                    con el morro arriba; fallar cuesta velocidad, no la
 *                    carrera.
 *   6. BAJADA        descenso largo. Se gana mucha velocidad y hay que
 *                    gestionarla.
 *   7. ATERRIZAJE    la recepcion del final de la bajada, con una rampa de
 *                    salida que la absorbe si se llega alineado. Exigente pero
 *                    aprendible: el mismo sitio se pasa mejor cada vez.
 *
 * Las cotas estan elegidas para que el tabletop se pase con gas mantenido y el
 * step-up pida un poco mas: es la curva de aprendizaje del tramo.
 */

import { Terrain } from '../physics/Terrain';
import { TrackBuilder, SectorLabel } from './TrackBuilder';

/**
 * Piezas de terreno del corte vertical. `whoops` y `rockgarden` siguen
 * declaradas porque el codigo de render y los tests las conocen, pero la pista
 * no las coloca: estan congeladas hasta que se apruebe la conduccion.
 */
export type TerrainFeatureKind = 'tabletop' | 'stepup' | 'dropoff' | 'whoops' | 'rockgarden';

export interface TerrainFeature {
  kind: TerrainFeatureKind;
  startX: number;
  endX: number;
}

export interface TrackSector {
  name: string;
  startX: number;
  endX: number;
}

export interface TrackDefinition {
  terrain: Terrain;
  labels: SectorLabel[];
  terrainFeatures: TerrainFeature[];
  sectors: TrackSector[];
  startX: number;
  startY: number;
  finishX: number;
  length: number;
}

export function buildCanyonRun(): TrackDefinition {
  const builder = new TrackBuilder(0);
  const terrainFeatures: TerrainFeature[] = [];

  // 1. SALIDA — recta de aceleracion. Suficiente para llegar arriba de todo
  //    antes de la primera compresion, no tanto como para aburrir.
  builder.mark('START').flat(92);

  // 2. COMPRESION — vaguada suave. Hunde la suspension y la devuelve; es la
  //    primera vez que el jugador ve trabajar los muelles, sin riesgo.
  builder.mark('COMPRESSION').slope(12, -1.6).slope(12, 1.6).flat(18);

  // 3. TABLETOP — mesa: rampa, meseta y bajada. Quedarse corto cae encima.
  let featureStart = builder.cursorX;
  builder.mark('TABLETOP').tabletop(11, 3.4, 13, 12);
  terrainFeatures.push({ kind: 'tabletop', startX: featureStart, endX: builder.cursorX });

  // 4. RECUPERACION — recta con dos ondulaciones largas para recolocarse.
  builder.mark('RECOVERY').flat(34).waves(3, 0.45, 14).flat(60);

  // 5. STEP_UP — subida a plataforma. Pide llegar rapido y con el morro arriba.
  featureStart = builder.cursorX;
  builder.mark('STEP_UP').stepUp(11, 2.2, 9, 1.2, 9, 3.0, 30);
  terrainFeatures.push({ kind: 'stepup', startX: featureStart, endX: builder.cursorX });

  // 6. BAJADA — descenso largo desde la plataforma. Aqui se gana la velocidad
  //    que luego hay que gestionar.
  featureStart = builder.cursorX;
  builder.mark('DESCENT').dropOff(16, 40, 8.4, 24);
  terrainFeatures.push({ kind: 'dropoff', startX: featureStart, endX: builder.cursorX });

  // 7. ATERRIZAJE — recepcion con salida en subida suave que absorbe el golpe
  //    si se llega alineado, y castiga con velocidad si no.
  builder.mark('LANDING').slope(18, 1.2).flat(52);

  // META.
  builder.mark('FINISH').flat(64);

  const { points, labels, endX } = builder.build();
  const terrain = new Terrain(points);
  const labelX = (name: string): number => {
    const label = labels.find((item) => item.name === name);
    if (!label) throw new Error(`Sector label ausente: ${name}`);
    return label.x;
  };
  const finishX = endX - 26;

  // Un unico sector: los sectores estan congelados hasta aprobar la
  // conduccion, pero la estructura se conserva para no romper lo que ya
  // depende de ella.
  const sectors: TrackSector[] = [{ name: 'SLICE', startX: 0, endX: finishX }];
  void labelX;

  return {
    terrain,
    labels,
    terrainFeatures,
    sectors,
    startX: 6,
    startY: terrain.surfaceY(6) + 1.6,
    finishX,
    length: endX,
  };
}
