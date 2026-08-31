/**
 * CanyonRun.ts
 *
 * La pista del milestone 001: "Canyon Run". Progresion pensada para ~35-50s
 * a buen ritmo: recta de calentamiento, baches, whoops, salto simple, curva
 * peraltada, doble salto, bajada larga, seccion tecnica, triple grande,
 * subida, salto mega y meta. Incluye una linea alternativa de riesgo/premio
 * en la seccion tecnica: saltar el ritmo entero desde antes ahorra tiempo
 * pero aterriza mas lejos y mas empinado.
 */

import { Terrain } from '../physics/Terrain';
import { TrackBuilder, SectorLabel } from './TrackBuilder';

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

  builder.mark('START').flat(18);

  let featureStart = builder.cursorX;
  builder.mark('TABLETOP').tabletop(7, 3.0, 7, 7);
  terrainFeatures.push({ kind: 'tabletop', startX: featureStart, endX: builder.cursorX });

  builder.flat(10);
  featureStart = builder.cursorX;
  builder.mark('STEP_UP').stepUp(6, 1.8, 6, 1.4, 5, 2.4, 7);
  terrainFeatures.push({ kind: 'stepup', startX: featureStart, endX: builder.cursorX });

  builder.flat(16);
  featureStart = builder.cursorX;
  builder.mark('DROP_OFF').dropOff(8, 12, 3.0, 8);
  terrainFeatures.push({ kind: 'dropoff', startX: featureStart, endX: builder.cursorX });

  builder.flat(8).mark('BUMPS').waves(5, 0.32, 6);

  featureStart = builder.cursorX;
  builder.mark('WHOOPS').waves(7, 0.55, 3.2);
  terrainFeatures.push({ kind: 'whoops', startX: featureStart, endX: builder.cursorX });

  builder.flat(5);
  featureStart = builder.cursorX;
  builder.mark('ROCK_GARDEN').rockGarden(22, [0.8, 0.25, 1.1, 0.45, 0.95, 0.2, 0.75, 0.35]);
  terrainFeatures.push({ kind: 'rockgarden', startX: featureStart, endX: builder.cursorX });

  builder
    .flat(6)
    .mark('JUMP_SIMPLE')
    .rampUp(7, 2.2)
    .gapValley(11, 1.4)
    .landingSlope(6, 0.4)

    .flat(10)
    .mark('BANKED_TURN')
    .bankedBump(22, 2.6) // peralte: eleva y vuelve a bajar suavemente

    .flat(8)
    .mark('DOUBLE_JUMP')
    .rampUp(6, 2.6)
    .gapValley(15, 2.0)
    .landingSlope(7, 0.6)

    .flat(6)
    .mark('DESCENT')
    .slope(38, -14) // bajada larga, se gana mucha velocidad

    .flat(8)
    .mark('TECHNICAL')
    // Bache fisico real (bump_gate): no es solo un cartel, hay que soltar
    // gas o gestionar la compresion antes de entrar en el ritmo cerrado.
    .slope(2, 0.45)
    .slope(2, -0.45)
    // Seccion tecnica de ritmo cerrado; se puede saltar entera desde el borde
    // (JUMP_SIMPLE de riesgo mas abajo marca la salida) si se llega con
    // velocidad suficiente para el salto siguiente.
    .waves(7, 0.7, 2.6)

    .mark('RISK_LINE_JUMP') // linea de riesgo/premio: saltar toda la zona de aterrizaje corta
    .rampUp(6, 2.0)
    .gapValley(13, 2.6)
    .landingSlope(5, 0.5)

    .flat(10)
    .mark('BIG_TRIPLE')
    .rampUp(6.5, 3.2)
    .gapValley(12, 2.4)
    .landingSlope(5, 1.0)
    .flat(3)
    .rampUp(6, 3.0)
    .gapValley(12, 2.4)
    .landingSlope(5, 1.0)
    .flat(3)
    .rampUp(6.5, 3.4)
    .gapValley(13, 2.8)
    .landingSlope(6, 1.0)

    .flat(10)
    .mark('UPHILL')
    // Tramo inicial llano-ish: aqui vive el speed_pad (ver GameplayZones),
    // un empujon de velocidad real para encarar la subida con mas ritmo.
    .slope(10, 3.2)
    // Kicker real (alt_ramp): ruta alternativa dentro de la propia subida,
    // da un salto extra de premio a quien llega con velocidad de sobra en
    // vez de limitarse a subir pegado al suelo.
    .rampUp(4, 1.8)
    .landingSlope(3, 0.3)
    .slope(13, 4.7) // resto de la subida hasta arriba

    .flat(8)
    .mark('MEGA_JUMP')
    .rampUp(9, 5.2)
    .gapValley(22, 4.5)
    .landingSlope(9, 1.2)

    .flat(20)
    .mark('FINISH')
    .flat(20);

  const { points, labels, endX } = builder.build();
  const terrain = new Terrain(points);
  const labelX = (name: string): number => {
    const label = labels.find((item) => item.name === name);
    if (!label) throw new Error(`Sector label ausente: ${name}`);
    return label.x;
  };
  const finishX = endX - 15;
  const sectorBounds = [0, labelX('JUMP_SIMPLE'), labelX('TECHNICAL'), labelX('UPHILL'), finishX];
  const sectorNames = ['OPENING', 'AIR LINE', 'TECHNICAL', 'FINAL CLIMB'];
  const sectors = sectorNames.map((name, index) => ({ name, startX: sectorBounds[index], endX: sectorBounds[index + 1] }));

  return {
    terrain,
    labels,
    terrainFeatures,
    sectors,
    startX: 4,
    startY: terrain.surfaceY(4) + 2.2,
    finishX,
    length: endX,
  };
}
