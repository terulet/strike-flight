/**
 * SpriteAssets.ts
 *
 * Carga las imagenes de personaje/moto/efectos (assets reales, generados
 * fuera del juego) y expone su calibracion geometrica: los puntos de pivote
 * en pixeles de cada imagen que hacen falta para posicionarlas de forma
 * rigida sobre el chasis fisico (ejes de rueda, cadera del piloto).
 *
 * Los sprites se sirven en WebP. En PNG la build pesaba 18 MB: son imagenes
 * fotograficas con alfa -canones, publico, la propia moto-, el peor caso
 * posible para un formato sin perdida. En WebP ocupan la cuarta parte sin
 * diferencia visible; la moto, las ruedas y el piloto van a mas calidad
 * porque son las piezas que se ven grandes (ver assets-src/compress_sprites.py).
 *
 * Se procesaron a partir del material de referencia de la marca:
 * la moto se nivelo (giro de correccion) para que la linea de ejes quedara
 * horizontal, y la rueda delantera/trasera se recortaron por separado para
 * poder moverlas de forma independiente segun la compresion real de la
 * suspension (ver Bike.wheelVisualCenterWorld).
 *
 * Los recortes de rueda originales arrastraban piezas del CHASIS -la horquilla
 * y el guardabarros en la delantera, el basculante y la cadena en la trasera-,
 * que al girar la rueda daban vueltas como una helice. Las ruedas que se
 * sirven ahora las produce `assets-src/extract_wheels.py`: discos de neumatico
 * limpios, reconstruidos por simetria de revolucion donde el chasis los tapaba,
 * y reencuadrados con el buje en el centro exacto de la imagen.
 */

import bikeBodyUrl from '../sprites/bike_body.webp';
import wheelFrontUrl from '../sprites/wheel_front.webp';
import wheelRearUrl from '../sprites/wheel_rear.webp';
import riderUrl from '../sprites/rider.webp';
import riderTorsoUrl from '../sprites/rider_torso.webp';
import riderArmUpperUrl from '../sprites/rider_arm_upper.webp';
import riderArmForeUrl from '../sprites/rider_arm_fore.webp';
import riderThighUrl from '../sprites/rider_thigh.webp';
import riderShinUrl from '../sprites/rider_shin.webp';
import dirtSprayUrl from '../sprites/dirt_spray.webp';
import landingImpactUrl from '../sprites/landing_impact.webp';
import finishGateUrl from '../sprites/finish_gate.webp';
import startGateUrl from '../sprites/start_gate.webp';
import barrierUrl from '../sprites/barrier.webp';
import rockClusterAUrl from '../sprites/rock_cluster_a.webp';
import bannerFlagUrl from '../sprites/banner_flag.webp';
import cactusClusterUrl from '../sprites/cactus_cluster.webp';
import rockClusterBUrl from '../sprites/rock_cluster_b.webp';
import jumpSignUrl from '../sprites/jump_sign.webp';
import fenceBannerUrl from '../sprites/fence_banner.webp';
import bgFarUrl from '../sprites/bg_far.webp';
import bgMidUrl from '../sprites/bg_mid.webp';
import riderCrashUrl from '../sprites/rider_crash.webp';
import redlineFxUrl from '../sprites/redline_fx.webp';
import dangerFlagsUrl from '../sprites/danger_flags.webp';
import ropeBarrierUrl from '../sprites/rope_barrier.webp';
import tireSkidUrl from '../sprites/tire_skid.webp';
import brokenBarrierUrl from '../sprites/broken_barrier.webp';
import logObstacleUrl from '../sprites/log_obstacle.webp';
import tireStackUrl from '../sprites/tire_stack.webp';
import boulderUrl from '../sprites/boulder.webp';
import tireMoundUrl from '../sprites/tire_mound.webp';
import ropeTireBarrierUrl from '../sprites/rope_tire_barrier.webp';
import foregroundAUrl from '../sprites/foreground_a.webp';
import foregroundBUrl from '../sprites/foreground_b.webp';
import speedStreakUrl from '../sprites/speed_streak.webp';
import speedDebrisUrl from '../sprites/speed_debris.webp';
import crowdUrl from '../sprites/crowd.webp';
import paddockTentUrl from '../sprites/paddock_tent.webp';
import speedPadUrl from '../sprites/speed_pad.webp';
import riskGapUrl from '../sprites/risk_gap.webp';
import altRampUrl from '../sprites/alt_ramp.webp';
import flowRingUrl from '../sprites/flow_ring.webp';
import bumpGateUrl from '../sprites/bump_gate.webp';
import speedPadFxUrl from '../sprites/speed_pad_fx.webp';
import altRampFxUrl from '../sprites/alt_ramp_fx.webp';
import bumpGateFxUrl from '../sprites/bump_gate_fx.webp';
import riskGapFxUrl from '../sprites/risk_gap_fx.webp';
import flowRingHitUrl from '../sprites/flow_ring_hit.webp';

/**
 * Sprites retirados del bundle (eran 4,4 MB de PNG que se descargaban para no
 * dibujarse nunca):
 *
 *  - `terrain_tabletop/stepup/dropoff/whoops/rockgarden`: BORRADOS. Eran
 *    imagenes estiradas al rango x de cada obstaculo, asi que su silueta no
 *    coincidia -y no podia coincidir- con la curva contra la que se choca. El
 *    relieve lo dibuja ahora TerrainPainter derivandolo de la propia curva de
 *    colision, de modo que no hay version de estos PNG que sirva.
 *  - `checkpoint_gate`, `photographer`, `marshal_flag`, `pickup_truck`,
 *    `ramp_deco`, `ramp_small`: siguen en `src/sprites/` pero SIN importar.
 *    El arco tapaba la moto entera con el encuadre cerrado, y el resto es
 *    ambientacion atada a sectores que el corte vertical no tiene; una pista
 *    futura con mas sectores puede volver a engancharlos.
 */
function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

export const SpriteImages = {
  bikeBody: loadImage(bikeBodyUrl),
  wheelFront: loadImage(wheelFrontUrl),
  wheelRear: loadImage(wheelRearUrl),
  rider: loadImage(riderUrl),
  riderTorso: loadImage(riderTorsoUrl),
  riderArmUpper: loadImage(riderArmUpperUrl),
  riderArmFore: loadImage(riderArmForeUrl),
  riderThigh: loadImage(riderThighUrl),
  riderShin: loadImage(riderShinUrl),
  dirtSpray: loadImage(dirtSprayUrl),
  landingImpact: loadImage(landingImpactUrl),
  finishGate: loadImage(finishGateUrl),
  startGate: loadImage(startGateUrl),
  barrier: loadImage(barrierUrl),
  rockClusterA: loadImage(rockClusterAUrl),
  bannerFlag: loadImage(bannerFlagUrl),
  cactusCluster: loadImage(cactusClusterUrl),
  rockClusterB: loadImage(rockClusterBUrl),
  jumpSign: loadImage(jumpSignUrl),
  fenceBanner: loadImage(fenceBannerUrl),
  bgFar: loadImage(bgFarUrl),
  bgMid: loadImage(bgMidUrl),
  riderCrash: loadImage(riderCrashUrl),
  redlineFx: loadImage(redlineFxUrl),
  dangerFlags: loadImage(dangerFlagsUrl),
  ropeBarrier: loadImage(ropeBarrierUrl),
  tireSkid: loadImage(tireSkidUrl),
  brokenBarrier: loadImage(brokenBarrierUrl),
  logObstacle: loadImage(logObstacleUrl),
  tireStack: loadImage(tireStackUrl),
  boulder: loadImage(boulderUrl),
  tireMound: loadImage(tireMoundUrl),
  ropeTireBarrier: loadImage(ropeTireBarrierUrl),
  foregroundA: loadImage(foregroundAUrl),
  foregroundB: loadImage(foregroundBUrl),
  speedStreak: loadImage(speedStreakUrl),
  speedDebris: loadImage(speedDebrisUrl),
  crowd: loadImage(crowdUrl),
  paddockTent: loadImage(paddockTentUrl),
  speedPad: loadImage(speedPadUrl),
  riskGap: loadImage(riskGapUrl),
  altRamp: loadImage(altRampUrl),
  flowRing: loadImage(flowRingUrl),
  bumpGate: loadImage(bumpGateUrl),
  speedPadFx: loadImage(speedPadFxUrl),
  altRampFx: loadImage(altRampFxUrl),
  bumpGateFx: loadImage(bumpGateFxUrl),
  riskGapFx: loadImage(riskGapFxUrl),
  flowRingHit: loadImage(flowRingHitUrl),
};

/** Un punto de pivote en pixeles de imagen (origen arriba-izquierda, Y hacia abajo). */
export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Calibracion geometrica de los sprites, extraida una vez del material
 * fuente (ver cross-rush/assets-src, script de preprocesado). Todo en
 * pixeles de las imagenes ya recortadas/escaladas que se sirven en juego.
 */
export const SpriteCalibration = {
  bike: {
    /** Eje trasero y delantero dentro de bike_body.png, misma altura (moto nivelada). */
    rearAxlePx: { x: 107.5, y: 322.0 } as PixelPoint,
    frontAxlePx: { x: 575.9, y: 322.0 } as PixelPoint,
  },
  /**
   * Ruedas: el pivote es el centro EXACTO de la imagen, y no por casualidad.
   * `assets-src/extract_wheels.py` recorta cada neumatico en un disco y
   * reencuadra la imagen alrededor del buje precisamente para que el pivote no
   * pueda volver a desalinearse. Los recortes originales tenian el buje a 18 y
   * 24 px del centro de imagen, y una rueda con el pivote fuera del buje no
   * rueda: ORBITA.
   *
   * `tyreRadiusPx` es el radio del neumatico medido en la imagen. No se usa
   * para escalar -las tres piezas comparten la escala del chasis, que es lo
   * unico que mantiene cada rueda dentro de su horquilla-, sino como
   * documentacion de donde sale `BikeConfig.wheelRadius`: 126.1 px de radio
   * medio sobre 468.4 px entre ejes obligan, con 1.35 m de distancia entre
   * ejes, a un radio fisico de 0.363 m.
   */
  wheelRear: { pivotPx: { x: 134.0, y: 134.0 } as PixelPoint, tyreRadiusPx: 131.3 },
  wheelFront: { pivotPx: { x: 123.0, y: 123.0 } as PixelPoint, tyreRadiusPx: 120.8 },
  rider: {
    /** Punto de cadera/asiento dentro de rider.png, para anclarlo al asiento de la moto. */
    hipPivotPx: { x: 105.0, y: 226.0 } as PixelPoint,
    /** Altura efectiva asumida de la postura agachada, en metros (calibra la escala del piloto). */
    assumedHeightMeters: 1.4,
  },

  /**
   * Piloto articulado. Las cinco piezas las produce
   * `assets-src/slice_rider.py` a partir de la foto original, y su calibracion
   * -tamano y pivote de cada una, longitudes de hueso- queda volcada en
   * `assets-src/rider_rig.json`. Aqui se copia lo que necesita el render.
   *
   * `pxPerMeter` es la escala del piloto: 300 px por metro. No es arbitraria,
   * sale de que con ella el alcance de la pierna (156.7 px = 0.52 m) cubre
   * holgadamente la distancia de la cadera a la estribera (0.40 m) con la
   * rodilla doblada, y el del brazo (98 px = 0.33 m) cubre la del hombro al
   * manillar (0.25 m) con el codo doblado. Es decir: el piloto llega a los dos
   * agarres sin estirarse del todo, que es como se conduce.
   */
  riderRig: {
    pxPerMeter: 300,
    /** Angulo del hueso en la foto, en convenio de mundo (Y arriba). */
    torso: { pivotPx: { x: 105.0, y: 226.0 } as PixelPoint, shoulderPx: { x: 158.0, y: 122.0 } as PixelPoint },
    armUpper: { pivotPx: { x: 38.0, y: 34.0 } as PixelPoint, lengthPx: 58.3, restAngle: -0.5404 },
    armFore: { pivotPx: { x: 40.0, y: 16.0 } as PixelPoint, lengthPx: 39.7, restAngle: -0.588 },
    thigh: { pivotPx: { x: 35.0, y: 44.0 } as PixelPoint, lengthPx: 85.8, restAngle: -0.7112 },
    shin: { pivotPx: { x: 54.0, y: 42.0 } as PixelPoint, lengthPx: 70.9, restAngle: -1.2847 },
  },
} as const;
