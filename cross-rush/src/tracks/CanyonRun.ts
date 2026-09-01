/**
 * CanyonRun.ts
 *
 * VERTICAL SLICE: una vuelta de ~57 s partida en dos mitades.
 *
 * Empezo siendo un tramo de 30-45 s con tres obstaculos, que era lo que pedia
 * el mandato mientras se aprobaba la sensacion de conducir. Aprobada esa, la
 * vuelta se alargo a peticion hasta los 1.026 m, y los 230 m nuevos son
 * OBSTACULOS, no recta: la regla al ampliar fue que ningun metro anadido
 * pudiera cruzarse sin hacer nada.
 *
 * La primera mitad ensena a conducir:
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
 *   8. RITMO         tres ondas grandes y un doble. El unico tramo con dos
 *                    lecturas validas: rodarlas o saltarlas de dos en dos. Va
 *                    aqui porque es donde mas velocidad se lleva, y una
 *                    seccion de ritmo sin velocidad es solo terreno feo.
 *
 * Las cotas estan elegidas para que el tabletop se pase con gas mantenido y el
 * step-up pida un poco mas: es la curva de aprendizaje del tramo.
 *
 * A partir de ahi empieza el ESPECTACULO. Los ocho tramos de arriba ensenan a
 * conducir; estos seis son la recompensa por haberlo aprendido, y suben la
 * apuesta uno detras de otro:
 *
 *   9. TECHNICAL   dos peraltes seguidos. Es el "aviso": la moto rebota, la
 *                  suspension trabaja y hay que recolocarse rapido.
 *  10. STEP_DOWN   plataforma corta desde la que se salta hacia ABAJO. Es el
 *                  reverso del step-up: alli castiga quedarse corto, aqui
 *                  pasarse.
 *  11. UPHILL      pad de velocidad y kicker. El pad regala FLOW y el kicker
 *                  manda arriba: primer salto de los grandes.
 *  12. RISK_LINE   la eleccion. Hay una linea segura que aterriza dentro del
 *                  valle a los 24 m, y una linea de riesgo que lo salta entero.
 *                  Pasarse de largo premia; quedarse corto cuesta caro.
 *  13. WASHBOARD   chapa de lavar y pedregal a toda velocidad. El unico tramo
 *                  que no se pasa saltando sino conduciendo, y el respiro en
 *                  el que se decide si guardarse el turbo para el mega salto.
 *  14. MEGA_JUMP   el salto imposible. Rampa larga sobre un canon de 26 m con
 *                  un aro de FLOW en mitad del aire. Se cruza a mas de 80 km/h,
 *                  con la camara abierta y a camara lenta.
 *  15. LAST_TABLE  una mesa antes de meta, para no terminar rodando en recta
 *                  cuatro segundos justo despues del salto grande.
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
 * Piezas de terreno del corte vertical. Las cinco se colocan: `whoops` y
 * `rockgarden` estuvieron congeladas mientras se aprobaba la conduccion
 * basica y ahora aparecen tres y dos veces respectivamente, en el tramo de
 * recuperacion, en la seccion de ritmo y en la chapa de lavar.
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
  //    antes de la primera compresion, no tanto como para aburrir. Las tres
  //    ondulaciones bajas del medio no son un obstaculo: son para que la
  //    suspension diga algo en los primeros segundos, que antes eran 92 m de
  //    llano absoluto.
  builder.mark('START').flat(42).waves(3, 0.32, 11).flat(20);

  // 2. COMPRESION — vaguada suave. Hunde la suspension y la devuelve; es la
  //    primera vez que el jugador ve trabajar los muelles, sin riesgo.
  builder.mark('COMPRESSION').slope(12, -1.6).slope(12, 1.6).flat(18);

  // 3. TABLETOP — mesa: rampa, meseta y bajada. Quedarse corto cae encima.
  let featureStart = builder.cursorX;
  builder.mark('TABLETOP').tabletop(11, 3.4, 13, 12);
  terrainFeatures.push({ kind: 'tabletop', startX: featureStart, endX: builder.cursorX });

  // 4. RECUPERACION — ya no es una recta de 136 m con tres ondulaciones. Los
  //    whoops y el pedregal estaban CONGELADOS mientras se aprobaba la
  //    conduccion basica; ahora que esta aprobada, entran aqui, que es donde
  //    habia el hueco mas largo de la vuelta. Van seguidos pero separados por
  //    llano: los whoops piden ritmo y el pedregal pide linea, y encadenarlos
  //    sin respirar solo produce un choque que no ensena nada.
  builder.mark('RECOVERY').flat(24);
  featureStart = builder.cursorX;
  builder.waves(6, 0.62, 8.5);
  terrainFeatures.push({ kind: 'whoops', startX: featureStart, endX: builder.cursorX });
  builder.flat(14);
  featureStart = builder.cursorX;
  builder.rockGarden(17, [0.5, 0.32, 0.62, 0.38, 0.55]);
  terrainFeatures.push({ kind: 'rockgarden', startX: featureStart, endX: builder.cursorX });
  builder.flat(16);

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
  //    si se llega alineado, y castiga con velocidad si no. Detras, una mesa
  //    pequena como puente hacia el tramo de espectaculo: se pasa sin pensar
  //    yendo rapido, y es el aviso de que la segunda mitad va de saltar.
  builder.mark('LANDING').slope(18, 1.2).flat(10);
  featureStart = builder.cursorX;
  builder.tabletop(7, 1.7, 5, 7);
  terrainFeatures.push({ kind: 'tabletop', startX: featureStart, endX: builder.cursorX });
  builder.flat(12);

  // 8. RITMO — la seccion de ritmo, que es lo que le faltaba a la vuelta.
  //
  //    Tres ondas grandes seguidas de un doble pequeno. Las ondas admiten dos
  //    lecturas -rodarlas pegado al suelo o saltarlas de dos en dos- y esa es
  //    justo la gracia: no hay una linea correcta, hay una linea rapida que
  //    hay que encontrar. El doble de detras cobra por haber salido bien de
  //    las ondas, porque se cruza entero solo si se llega lanzado.
  //
  //    Va aqui y no antes porque es el punto de la vuelta donde mas velocidad
  //    se lleva (se viene del descenso), y una seccion de ritmo sin velocidad
  //    es solo terreno feo.
  builder.mark('RHYTHM').flat(8);
  featureStart = builder.cursorX;
  builder.waves(3, 1.1, 14);
  terrainFeatures.push({ kind: 'whoops', startX: featureStart, endX: builder.cursorX });
  builder.flat(10);
  featureStart = builder.cursorX;
  // Mesa, no hueco. Llego a estar con `gapValley` y era un error de diseno:
  // este tramo cae en la mitad de APRENDIZAJE, cuya promesa es que quedarse
  // corto te deja ENCIMA del obstaculo. Con el hueco, un jugador competente
  // que llegara un poco lento por haber aterrizado regular antes se clavaba
  // dentro -medido: el piloto automatico competente moria aqui, en el metro
  // 569, y no llegaba a meta-. Un hueco es material de la segunda mitad.
  builder.rampUp(7, 1.9).flat(9).slope(8, -1.9);
  terrainFeatures.push({ kind: 'tabletop', startX: featureStart, endX: builder.cursorX });
  builder.flat(12);

  // ---------------------------------------------------------------- ESPECTACULO

  // 8. TECHNICAL — dos peraltes. El primero, centrado a 2 m de la etiqueta,
  //    es el que GameplayZones convierte en bump_gate.
  builder.mark('TECHNICAL').bankedBump(4, 0.5).flat(3).bankedBump(5, 0.42).flat(14);

  // 10. STEP_DOWN — se sube a una plataforma y se salta DESDE ella hacia
  //     abajo. Es el reverso del step-up del tramo de aprendizaje: alli el
  //     salto castiga quedarse corto, aqui castiga pasarse, porque el borde
  //     manda arriba y el suelo se aparta. Corto y sin hueco a proposito: es
  //     un enlace entre los peraltes y el primer salto grande, no otro salto
  //     grande.
  featureStart = builder.cursorX;
  //     El borde manda arriba, asi que detras hace falta suelo que se aparte:
  //     la caida no puede recibirse en llano. Llego a estar como
  //     `slope(7,-3.2).flat(15)` y el piloto automatico competente moria justo
  //     ahi, en el metro 647, aterrizando contra el llano de detras. Es el
  //     mismo motivo por el que el mega salto tiene rampa de recepcion: lo que
  //     convierte un vuelo en un aterrizaje es que el terreno baje mientras la
  //     moto cae.
  builder.mark('STEP_DOWN').rampUp(9, 2.6).flat(9).slope(10, -3.2).slope(6, -0.7).flat(12);
  terrainFeatures.push({ kind: 'dropoff', startX: featureStart, endX: builder.cursorX });

  // 9. UPHILL — pad de velocidad a los 2 m y kicker a los 10, que son
  //    exactamente los offsets que GameplayZones espera.
  //
  //    La recta de salida es larga (34 m) por una razon medida: con 16 m, el
  //    vuelo de 22 m de este kicker terminaba a 6 m del labio del salto
  //    siguiente. Se aterrizaba y se despegaba otra vez sin un solo instante
  //    para recolocarse, y la moto llegaba al segundo salto a 8 m/s y de
  //    morro: crash garantizado, y ademas injusto, porque no habia forma de
  //    evitarlo. Entre dos saltos grandes tiene que haber sitio para respirar.
  builder.mark('UPHILL').flat(10).rampUp(9, 2.2).landingSlope(16, 2.2).flat(9).bankedBump(9, 0.75).flat(14);

  // 10. RISK_LINE_JUMP — las dos lineas. La segura toca tierra a los 24 m
  //     (6 + 13 + 5); pasar de ahi es haber saltado el hueco entero.
  builder.mark('RISK_LINE_JUMP').rampUp(6, 2.6).gapValley(13, 4).flat(5).flat(8);

  // 12. WASHBOARD — chapa de lavar y pedregal, a toda velocidad.
  //
  //     Es el unico tramo de la vuelta que no se pasa saltando sino
  //     conduciendo: las ondas son cortas y bajas, asi que a 19 m/s la moto
  //     las toca todas y la suspension trabaja sin parar. Sirve para dos
  //     cosas: da un respiro entre la linea de riesgo y el mega salto -que es
  //     el sitio donde el jugador tiene que decidir si se guarda el turbo- y
  //     deja claro que la moto tiene muelles justo antes del salto en el que
  //     mas van a importar.
  //
  //     Va ANTES de la bajada de impulso, no despues: la bajada existe para
  //     que la moto llegue lanzada al kicker del mega salto, y meterle
  //     obstaculos por medio seria deshacer lo que hace.
  featureStart = builder.cursorX;
  builder.waves(7, 0.55, 7.5);
  terrainFeatures.push({ kind: 'whoops', startX: featureStart, endX: builder.cursorX });
  builder.flat(10);
  featureStart = builder.cursorX;
  builder.rockGarden(14, [0.42, 0.6, 0.34, 0.55]);
  terrainFeatures.push({ kind: 'rockgarden', startX: featureStart, endX: builder.cursorX });
  builder.flat(10);

  // Bajada de impulso hacia el mega salto. NO lleva etiqueta propia a
  // proposito: tiene que quedar ANTES de MEGA_JUMP para que la rampa siga
  // empezando exactamente en la etiqueta, que es de donde GameplayZones saca
  // la posicion del aro.
  //
  // Medido: sin ella la moto llegaba al kicker a 12,8 m/s y se estampaba
  // dentro del canon. La bajada larga es lo que convierte el salto en algo
  // que se puede hacer, y ademas se ve venir desde lejos, que es justo lo que
  // se quiere antes del salto grande.
  builder.slope(40, -14).flat(14);

  // 11. MEGA_JUMP — el salto grande, sobre un canon de 20 m y 11 de hondo,
  //     con el aro de FLOW a media trayectoria.
  //
  //     El kicker sube 4,6 m en 8, o sea que sale a 43 grados. Es mucho mas
  //     vertical que el resto de saltos de la pista, y esta hecho a proposito:
  //     lo que hace posible un mortal no es la distancia, es el TIEMPO DE
  //     AIRE, y el tiempo de aire es 2*vy/g. Una rampa tendida manda la
  //     velocidad hacia adelante y da un salto largo pero corto de tiempo; una
  //     empinada la manda hacia arriba.
  //
  //     Empinarla sale caro en velocidad -subir 4,6 m cuesta 177 m2/s2- y por
  //     eso hay un pad de turbo justo antes: entra a 27 m/s en vez de 21, y de
  //     ahi salen mas de 1,6 s de vuelo. Con eso, y con el giro comprometido
  //     de 9 rad/s, cabe una vuelta entera sobrada y hasta se puede intentar
  //     la doble.
  //
  //     La rampa de recepcion baja 12 m en 30 (22 grados) por la misma razon
  //     por la que las baja una pista de verdad: la moto llega cayendo a unos
  //     45 grados, y contra un suelo llano eso es un impacto de 17 m/s -crash
  //     garantizado-. Con el suelo apartandose, el golpe real baja a menos de
  //     9. Es lo que convierte un vuelo de segundo y medio en un aterrizaje.
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
  builder.mark('MEGA_JUMP').rampUp(11, 5.5).gapValley(26, 6).landingSlope(30, 12).flat(26);

  // 14. LAST_TABLE — una mesa pequena antes de meta. La recta de llegada era
  //     de 72 m seguidos: despues del salto mas grande de la vuelta, terminar
  //     rodando en linea recta durante cuatro segundos apaga el tramo justo
  //     cuando deberia estar celebrandose. La mesa se pasa sin frenar y da un
  //     ultimo eslabon de cadena para cruzar la meta con el multiplicador
  //     vivo.
  featureStart = builder.cursorX;
  builder.tabletop(9, 2.2, 6, 9);
  terrainFeatures.push({ kind: 'tabletop', startX: featureStart, endX: builder.cursorX });

  // META.
  builder.mark('FINISH').flat(40);

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
