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
 *
 * A partir de ahi empieza el ESPECTACULO. Los siete tramos de arriba ensenan a
 * conducir; estos cuatro son la recompensa por haberlo aprendido, y suben la
 * apuesta uno detras de otro:
 *
 *   8. TECHNICAL   dos peraltes seguidos. Es el "aviso": la moto rebota, la
 *                  suspension trabaja y hay que recolocarse rapido.
 *   9. UPHILL      pad de velocidad y kicker. El pad regala FLOW y el kicker
 *                  manda arriba: primer salto de los grandes.
 *  10. RISK_LINE   la eleccion. Hay una linea segura que aterriza dentro del
 *                  valle a los 24 m, y una linea de riesgo que lo salta entero.
 *                  Pasarse de largo premia; quedarse corto cuesta caro.
 *  11. MEGA_JUMP   el salto imposible. Rampa larga sobre un canon de 26 m con
 *                  un aro de FLOW en mitad del aire. Se cruza a mas de 80 km/h,
 *                  con la camara abierta y a camara lenta.
 *
 * Las piezas de riesgo/recompensa NO se colocan a mano: `GameplayZones` las
 * deriva de estas mismas etiquetas de sector, asi que la pieza que se ve y la
 * que actua salen del mismo sitio por construccion. Las medidas de abajo son
 * las que ese modulo da por supuestas (rampa de 6 m + valle de 13 m + 5 m de
 * recepcion en la linea de riesgo; rampa de 9 m antes del canon en el mega
 * salto); cambiarlas aqui sin cambiarlas alli desalinea sprite y mecanica.
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
  builder.mark('LANDING').slope(18, 1.2).flat(30);

  // ---------------------------------------------------------------- ESPECTACULO

  // 8. TECHNICAL — dos peraltes. El primero, centrado a 2 m de la etiqueta,
  //    es el que GameplayZones convierte en bump_gate.
  builder.mark('TECHNICAL').bankedBump(4, 0.5).flat(3).bankedBump(5, 0.42).flat(18);

  // 9. UPHILL — pad de velocidad a los 2 m y kicker a los 10, que son
  //    exactamente los offsets que GameplayZones espera.
  //
  //    La recta de salida es larga (34 m) por una razon medida: con 16 m, el
  //    vuelo de 22 m de este kicker terminaba a 6 m del labio del salto
  //    siguiente. Se aterrizaba y se despegaba otra vez sin un solo instante
  //    para recolocarse, y la moto llegaba al segundo salto a 8 m/s y de
  //    morro: crash garantizado, y ademas injusto, porque no habia forma de
  //    evitarlo. Entre dos saltos grandes tiene que haber sitio para respirar.
  builder.mark('UPHILL').flat(10).rampUp(9, 2.2).landingSlope(16, 2.2).flat(34);

  // 10. RISK_LINE_JUMP — las dos lineas. La segura toca tierra a los 24 m
  //     (6 + 13 + 5); pasar de ahi es haber saltado el hueco entero.
  builder.mark('RISK_LINE_JUMP').rampUp(6, 2.6).gapValley(13, 4).flat(5).flat(8);

  // Bajada de impulso hacia el mega salto. NO lleva etiqueta propia a
  // proposito: tiene que quedar ANTES de MEGA_JUMP para que la rampa siga
  // empezando exactamente en la etiqueta, que es de donde GameplayZones saca
  // la posicion del aro.
  //
  // Medido: sin ella la moto llegaba al kicker a 12,8 m/s y se estampaba
  // dentro del canon. La bajada larga es lo que convierte el salto en algo
  // que se puede hacer, y ademas se ve venir desde lejos, que es justo lo que
  // se quiere antes del salto grande.
  builder.slope(40, -14).flat(12);

  // 11. MEGA_JUMP — el salto grande, sobre un canon de 20 m y 11 de hondo,
  //     con el aro de FLOW a media trayectoria.
  //
  //     La rampa es BAJA (3,2 m) a proposito. Subir 4,2 m cuesta 161 m2/s2 de
  //     energia -de 20 m/s a 15,5- y ademas sale tan empinada que casi toda la
  //     velocidad se va hacia arriba: el salto quedaba alto y corto. Rampa
  //     baja y entrada rapida da lo contrario, que es lo que se ve espectacular:
  //     una trayectoria larga y tendida cruzando el hueco entero.
  //
  //     El hueco mide 18 m y el vuelo medido son 21,8: se cruza entero y se
  //     cae 4 m dentro de la rampa de recepcion, que baja. Con 20 m y una
  //     entrada mas lenta el vuelo se quedaba en 15,7 y la moto se estampaba
  //     contra la pared de subida: esa es la diferencia entre un salto
  //     exigente y uno imposible de verdad.
  //     La profundidad no la manda el gusto, la mandan dos cosas medidas.
  //
  //     La PARED: el valle es una sinusoide, asi que hondura y anchura fijan
  //     la pendiente maxima (profundidad * PI / ancho). Con 11 m sobre 18
  //     salian paredes de 62 grados, que ni se remontan si te quedas corto ni
  //     las sobrevive un piloto que apunte al terreno que viene.
  //
  //     Y el ENCUADRE: con la vista cerrada de este juego, un tajo de 11 m no
  //     cabe en pantalla. Se veia la moto volando sobre un fondo liso, sin
  //     labio de salida ni de llegada: o sea, sin hueco. Un canon que no se ve
  //     no da miedo. Con 5,5 m entran los dos labios y la caida en cuadro, y
  //     ademas la pared se queda en 44 grados, por debajo del limite de lo
  //     rodable.
  builder.mark('MEGA_JUMP').rampUp(9, 3.2).gapValley(18, 5.5).landingSlope(22, 4).flat(24);

  // META.
  builder.mark('FINISH').flat(58);

  const { points, labels, endX } = builder.build();
  const terrain = new Terrain(points);
  const labelX = (name: string): number => {
    const label = labels.find((item) => item.name === name);
    if (!label) throw new Error(`Sector label ausente: ${name}`);
    return label.x;
  };
  const finishX = endX - 26;

  // Dos sectores: el tramo de aprendizaje y el de espectaculo. Siguen sin
  // usarse para parciales comparados -eso es el delta avanzado, que sigue
  // congelado-, pero separar donde acaba uno y empieza el otro es lo que
  // permite que el HUD diga en que parte de la vuelta estas.
  const showX = labelX('TECHNICAL');
  const sectors: TrackSector[] = [
    { name: 'APRENDIZAJE', startX: 0, endX: showX },
    { name: 'ESPECTACULO', startX: showX, endX: finishX },
  ];

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
