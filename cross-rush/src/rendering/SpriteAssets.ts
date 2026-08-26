/**
 * SpriteAssets.ts
 *
 * Carga las imagenes de personaje/moto/efectos (assets reales, generados
 * fuera del juego) y expone su calibracion geometrica: los puntos de pivote
 * en pixeles de cada imagen que hacen falta para posicionarlas de forma
 * rigida sobre el chasis fisico (ejes de rueda, cadera del piloto).
 *
 * Los PNG se procesaron a partir del material de referencia de la marca:
 * la moto se nivelo (giro de correccion) para que la linea de ejes quedara
 * horizontal, y la rueda delantera/trasera se recortaron por separado para
 * poder moverlas de forma independiente segun la compresion real de la
 * suspension (ver Bike.wheelVisualCenterWorld). El casco/chasis en si no
 * tiene mas piezas moviles: es una unica imagen rigida.
 */

import bikeBodyUrl from '../sprites/bike_body.png';
import wheelFrontUrl from '../sprites/wheel_front.png';
import wheelRearUrl from '../sprites/wheel_rear.png';
import riderUrl from '../sprites/rider.png';
import dirtSprayUrl from '../sprites/dirt_spray.png';
import landingImpactUrl from '../sprites/landing_impact.png';
import finishGateUrl from '../sprites/finish_gate.png';
import startGateUrl from '../sprites/start_gate.png';
import checkpointGateUrl from '../sprites/checkpoint_gate.png';
import barrierUrl from '../sprites/barrier.png';
import rockClusterAUrl from '../sprites/rock_cluster_a.png';
import bannerFlagUrl from '../sprites/banner_flag.png';

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
  dirtSpray: loadImage(dirtSprayUrl),
  landingImpact: loadImage(landingImpactUrl),
  finishGate: loadImage(finishGateUrl),
  startGate: loadImage(startGateUrl),
  checkpointGate: loadImage(checkpointGateUrl),
  barrier: loadImage(barrierUrl),
  rockClusterA: loadImage(rockClusterAUrl),
  bannerFlag: loadImage(bannerFlagUrl),
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
  wheelRear: { pivotPx: { x: 159.4, y: 160.0 } as PixelPoint },
  wheelFront: { pivotPx: { x: 160.0, y: 159.7 } as PixelPoint },
  rider: {
    /** Punto de cadera/asiento dentro de rider.png, para anclarlo al asiento de la moto. */
    hipPivotPx: { x: 69.0, y: 188.4 } as PixelPoint,
    /** Altura efectiva asumida de la postura agachada, en metros (calibra la escala del piloto). */
    assumedHeightMeters: 1.3,
  },
} as const;
