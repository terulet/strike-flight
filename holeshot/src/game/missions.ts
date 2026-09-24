/**
 * La gira: cinco pruebas, cada una con su mundo, su trazado y su objetivo.
 *
 *  1. CANON ROJO        contrarreloj de iniciacion al atardecer
 *  2. LA CANTERA        caza de placas doradas sobre fosos y terrazas
 *  3. BOSQUE DE NIEBLA  show de trucos: saltos largos pensados para mortales
 *  4. TORMENTA DE ARENA persecucion: un muro de arena avanza detras de ti
 *  5. ESTADIO NOCTURNO  la gran final de supercross bajo los focos
 */
import { TrackBuilder, TrackData } from '../physics/trackBuilder';
import { alignAirPickups } from './racingLine';
import type { RivalSpec } from './rival';

export type Objective = 'time' | 'plates' | 'tricks' | 'storm' | 'final';
export type LayerKind = 'mesas' | 'mountains' | 'hills' | 'dunes' | 'pines' | 'quarry' | 'stadium' | 'city' | 'cliffs';
export type Weather = 'dust' | 'fog' | 'sand' | 'embers' | 'confetti' | 'none';

export interface BackdropLayer {
  kind: LayerKind;
  color: string;
  /** Color del borde iluminado (rim light) de la silueta. */
  rim: string;
  parallax: number;
  /** Linea base en fraccion del alto de pantalla. */
  base: number;
  /** Alto maximo en fraccion del alto de pantalla. */
  height: number;
  seed: number;
}

export interface Theme {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  sun: { x: number; y: number; r: number; color: string; glow: string } | null;
  stars: boolean;
  layers: BackdropLayer[];
  /** Bruma entre capas (rgb sin alfa: "r,g,b"). */
  haze: string;
  ground: {
    crust: string;
    crustShade: string;
    strata: string[];
    rim: string;
    grass: string | null;
    pebble: string;
    dust: string;
  };
  weather: Weather;
  night: boolean;
  accent: string;
  /** Lo que hay al fondo de los fosos. */
  pitHazard?: 'water' | 'fire' | 'rocks';
  /** Color de las piedras de la pista (si no, sale de los estratos). */
  rockColor?: string;
  /** Decorados tipicos de este mundo (para las pistas generadas). */
  props?: Array<'cactus' | 'boulder' | 'crane' | 'tires' | 'pine' | 'tree' | 'light' | 'hay' | 'fence' | 'flag'>;
}

export interface Medals {
  /** Tiempo de referencia para la bonificacion de llegada. */
  parTime: number;
  gold: number;
  silver: number;
  /** Solo en la prueba de trucos: puntos de truco para plata y oro. */
  silverScore?: number;
  goldScore?: number;
  /** Solo en la cantera: placas para plata y oro. */
  silverPlates?: number;
  goldPlates?: number;
}

export interface Mission {
  id: number;
  name: string;
  place: string;
  objective: Objective;
  objectiveText: string;
  briefing: string;
  track: TrackData;
  theme: Theme;
  medals: Medals;
  /** Pilotos rivales en pista (vacio = prueba en solitario). */
  rivals: RivalSpec[];
  /** Solo en el Barro del Dia. */
  daily?: { key: string; number: number };
}

// ---------------------------------------------------------------------------
// Regla de checkpoints: se colocan SIEMPRE al principio de una recta larga,
// con carrerilla de sobra antes del siguiente salto. Reaparecer delante de un
// foso sin velocidad es una trampa sin salida: caes, reapareces y vuelves a
// caer. Hay una prueba que lo comprueba desde cada checkpoint.
// ---------------------------------------------------------------------------

// 1. CANON ROJO — contrarreloj
function canyon(): TrackData {
  const t = new TrackBuilder();
  t.section('SALIDA').prop('crowd', 4, 1).prop('flag', -3).prop('banner', 14).flat(52);
  t.whoops(3, 0.7, 12).flat(22).prop('cactus', 10).prop('tires', 26);
  t.section('LA MESA').tabletop(8, 2.2, 10, 12).checkpoint().flat(28).prop('boulder', 12, 1, 1);
  t.section('LA CUESTA').prop('sign', 2).hill(42, 8).flat(12).prop('cactus', 5, 1.2, 1);
  t.slope(32, -8).flat(26).prop('flag', 8);
  t.checkpoint().flat(40).section('EL BARRANCO').kicker(8, 2.6).gap(14, 6, -0.4).landing(18, 2.2).flat(30);
  t.section('PEDREGAL').rocks(20, 6, 0.36).flat(6).mud(14).flat(10).prop('cactus', 6, 1, 1);
  t.stepUp(1.8).flat(20).prop('tires', 8).dropOff(1.8).flat(24);
  t.checkpoint().flat(30).section('LOS DOBLES').kicker(6, 1.8).landing(10, 1.8).flat(4).kicker(6, 1.8).landing(10, 1.8).flat(26);
  t.prop('boulder', 10, 1.3, 1).whoops(5, 0.5, 6).flat(26).section('EL MIRADOR').hill(30, 6).flat(10);
  t.kicker(6, 1.6).landing(26, 7.6).flat(28).prop('cactus', 8);
  t.checkpoint().flat(44).section('EL GRAN SALTO').kicker(10, 3.2).gap(18, 5, -0.6).landing(24, 2.6).flat(20);
  t.section('META').prop('crowd', 20).prop('banner', 8).flat(60);
  return t.build(8, 32);
}

// 2. LA CANTERA — placas doradas
function quarry(): TrackData {
  const t = new TrackBuilder();
  t.section('SALIDA').prop('crowd', 3).prop('crane', 30, 1.2, 1).flat(46);
  t.section('TERRAZAS').pickup('plate', 12, 9.2).stepUp(2.4).flat(22).pickup('plate', 8, 1.3).stepUp(2.4).flat(24);
  t.prop('tires', 6).flat(20);
  t.section('EL FOSO').kicker(7, 2).pickup('plate', 9, 10 + 3.2).gap(18, 10, -3).landing(16, 3).flat(26);
  t.section('EL CORTADO').prop('sign', 4).flat(10).dropOff(4.5).flat(14).tires(4, 12);
  t.checkpoint().flat(20).section('LA RAMPA DE CARGA').pickup('plate', 36, 1.4).hill(36, 10).flat(12).prop('crane', 4, 1, 1);
  t.kicker(6, 1.8).pickup('plate', 16, 9.85).landing(30, 12).flat(26);
  t.section('ESCOMBRERA').rocks(22, 8, 0.4).flat(16).whoops(5, 0.7, 6).flat(6).mud(16).flat(8).pickup('plate', 10, 1.2);
  t.checkpoint().flat(46).section('EL CRÁTER').kicker(9, 3.2).pickup('plate', 11, 15.45).gap(22, 12, 0).landing(20, 3.2).flat(26);
  t.section('LA TOLVA').hill(26, 5).flat(8).pickup('plate', 4, 8.5).dropOff(5).flat(18).tires(3, 10);
  t.checkpoint().flat(40).section('ÚLTIMO TAJO').tabletop(8, 2.4, 9, 11).pickup('plate', 6, 11.5).flat(36);
  t.kicker(8, 2.4).pickup('plate', 9, 17.5).gap(16, 7, -1).landing(16, 1.4).flat(20);
  t.section('META').prop('crowd', 22).prop('flag', 12).flat(60);
  return t.build(8, 32);
}

// 3. BOSQUE DE NIEBLA — show de trucos
function forest(): TrackData {
  const t = new TrackBuilder();
  t.section('SALIDA').prop('crowd', 4).prop('pine', 20, 1.2, 1).flat(46).logs(3, 6);
  t.flat(26).section('PRIMER VUELO').kicker(9, 3.2).flat(1).landing(28, 5).flat(24).prop('pine', 8, 1.3, 1);
  t.section('LOS TRONCOS').logs(2, 7, 0.34).mud(14).flat(8);
  t.checkpoint().flat(40).section('LA GARGANTA').kicker(10, 3.6).gap(20, 8, -2).landing(26, 4).flat(24).prop('tree', 12, 1, 1);
  t.section('RAÍCES').rocks(16, 6, 0.34).flat(4).mud(12).flat(6).hill(30, 6).flat(12);
  t.section('EL BALCÓN').kicker(8, 3).landing(32, 9).flat(26).whoops(4, 0.6, 6).flat(18);
  t.checkpoint().flat(30).section('EL TOBOGÁN').slope(40, -6).kicker(8, 2.8).landing(28, 5).flat(22).logs(2, 7);
  t.prop('pine', 10, 1.4, 1).mud(18).flat(12);
  t.checkpoint().flat(46).section('EL ARCO DEL BOSQUE').kicker(11, 4).gap(26, 10, -3).landing(28, 5).flat(26);
  t.section('META').prop('crowd', 20).prop('banner', 8).flat(60);
  return t.build(8, 32);
}

// 4. TORMENTA DE ARENA — persecucion
function dunes(): TrackData {
  const t = new TrackBuilder();
  t.section('SALIDA').prop('flag', 2).flat(40);
  t.section('DUNAS').slope(22, 4).slope(22, -4).slope(26, 5).kicker(5, 1.2).landing(24, 6.2).flat(14);
  t.prop('cactus', 6, 1, 1).kicker(8, 2.2).landing(18, 2.2).flat(22);
  t.checkpoint().flat(20).section('EL OASIS SECO').rocks(18, 5, 0.34).flat(4).mud(12).flat(6).slope(26, 6).flat(8).slope(26, -6).flat(16);
  t.section('LA DUNA ALTA').hill(40, 9).kicker(5, 1.4).landing(36, 10.4).flat(24).prop('boulder', 8, 1, 1);
  t.checkpoint().flat(30).section('CAUCE').whoops(5, 0.6, 7).flat(20).kicker(8, 2.4).gap(16, 6, -0.6).landing(18, 1.8).flat(24);
  t.section('RECTA DEL VIENTO').slope(30, 3).slope(30, -3).tabletop(8, 2.2, 8, 12).flat(22);
  t.checkpoint().flat(20).section('ÚLTIMA DUNA').slope(24, 5).kicker(5, 1.2).landing(30, 6.2).flat(22);
  t.section('META').prop('crowd', 18).prop('flag', 6).flat(60);
  return t.build(8, 32);
}

// 5. ESTADIO NOCTURNO — la final
function stadium(): TrackData {
  const t = new TrackBuilder();
  t.section('PARRILLA').prop('light', 0).prop('crowd', 6).prop('banner', 16).flat(44).prop('hay', 2);
  t.section('RITMO').kicker(6, 1.6).landing(9, 1.6).flat(3).kicker(6, 1.6).landing(9, 1.6).flat(3).kicker(6, 1.6).landing(9, 1.6).flat(4).checkpoint().flat(34);
  t.prop('light', 6, 1, 1).section('TRIPLE').kicker(8, 2.6).gap(20, 2.8, 0).landing(12, 2.6).flat(22).prop('hay', 4);
  t.checkpoint().flat(20).section('WHOOPS').whoops(7, 0.75, 5.5).flat(4).mud(12).flat(8).prop('light', 4, 1, 1);
  t.section('ESCALÓN').stepUp(2).flat(12).tabletop(7, 2, 6, 9).dropOff(2).flat(18).tires(3, 12);
  t.checkpoint().flat(30).section('LA MESA GRANDE').tabletop(9, 3, 14, 12).flat(22).prop('light', 2, 1, 1);
  t.section('RITMO FINAL').kicker(6, 1.8).landing(9, 1.8).flat(2).kicker(6, 1.8).landing(9, 1.8).flat(38);
  t.section('SEGUNDO TRIPLE').kicker(8, 2.8).gap(22, 3, 0).landing(12, 2.8).flat(24).whoops(5, 0.6, 5.5).flat(4).mud(10).flat(6);
  t.checkpoint().flat(52).section('EL SALTO DE FUEGO').kicker(11, 4).gap(28, 6, 0).landing(20, 4).flat(20);
  t.section('META').prop('crowd', 16).prop('light', 26, 1, 1).prop('banner', 8).flat(60);
  return t.build(8, 32);
}

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------
export const THEMES: Record<string, Theme> = {
  canyon: {
    skyTop: '#27335c',
    skyMid: '#c9607a',
    skyBottom: '#ffb86b',
    sun: { x: 0.74, y: 0.5, r: 0.07, color: '#fff1c1', glow: 'rgba(255, 170, 90, 0.55)' },
    stars: false,
    layers: [
      { kind: 'mesas', color: '#a9587a', rim: '#ffb58c', parallax: 0.06, base: 0.7, height: 0.28, seed: 3 },
      { kind: 'mesas', color: '#7d3a55', rim: '#ff9a6a', parallax: 0.14, base: 0.76, height: 0.3, seed: 11 },
      { kind: 'cliffs', color: '#4f2238', rim: '#ff8c5a', parallax: 0.28, base: 0.84, height: 0.26, seed: 21 },
    ],
    haze: '255,160,120',
    ground: {
      crust: '#e08a4f',
      crustShade: '#a3502f',
      strata: ['#b85a35', '#9a4730', '#7a3528', '#55231f', '#35151a'],
      rim: '#ffd29a',
      grass: '#8a8a3a',
      pebble: '#6a2e22',
      dust: '#e9a878',
    },
    weather: 'dust',
    night: false,
    accent: '#ff6a3d',
    pitHazard: 'rocks',
    props: ['cactus', 'boulder', 'flag'],
  },
  quarry: {
    skyTop: '#5d7fa6',
    skyMid: '#b9c9d6',
    skyBottom: '#efe4cf',
    sun: { x: 0.2, y: 0.28, r: 0.05, color: '#fffbea', glow: 'rgba(255, 245, 210, 0.45)' },
    stars: false,
    layers: [
      { kind: 'mountains', color: '#9aa8b8', rim: '#e8eef4', parallax: 0.05, base: 0.68, height: 0.3, seed: 5 },
      { kind: 'quarry', color: '#8b8579', rim: '#dcd3c2', parallax: 0.15, base: 0.76, height: 0.3, seed: 8 },
      { kind: 'quarry', color: '#5f5a52', rim: '#c9bda6', parallax: 0.3, base: 0.84, height: 0.24, seed: 14 },
    ],
    haze: '220,220,214',
    ground: {
      crust: '#c8b89a',
      crustShade: '#8c7d66',
      strata: ['#9d8f78', '#857863', '#6d6150', '#51483c', '#35302a'],
      rim: '#fff4dc',
      grass: null,
      pebble: '#5b5347',
      dust: '#d9cfbb',
    },
    weather: 'dust',
    night: false,
    accent: '#ffc02e',
    pitHazard: 'water',
    props: ['crane', 'tires', 'boulder'],
  },
  forest: {
    skyTop: '#1d3a3a',
    skyMid: '#5f8a7d',
    skyBottom: '#c8d8c0',
    sun: { x: 0.62, y: 0.3, r: 0.06, color: '#f4ffe8', glow: 'rgba(220, 255, 220, 0.35)' },
    stars: false,
    layers: [
      { kind: 'hills', color: '#5e8474', rim: '#cfe6d2', parallax: 0.05, base: 0.66, height: 0.24, seed: 2 },
      { kind: 'pines', color: '#3f6558', rim: '#a8d0b8', parallax: 0.14, base: 0.74, height: 0.24, seed: 9 },
      { kind: 'pines', color: '#223f37', rim: '#7fb59a', parallax: 0.3, base: 0.84, height: 0.26, seed: 17 },
    ],
    haze: '200,225,210',
    ground: {
      crust: '#6b4a2e',
      crustShade: '#3f2a1a',
      strata: ['#5a3d26', '#4a321f', '#3a2718', '#2a1c12', '#1a120c'],
      rim: '#c9e0a8',
      grass: '#4f8a3a',
      pebble: '#2e2418',
      dust: '#8a7458',
    },
    weather: 'fog',
    night: false,
    accent: '#7ee07a',
    pitHazard: 'rocks',
    rockColor: '#6d7064',
    props: ['pine', 'tree', 'fence'],
  },
  dunes: {
    skyTop: '#7a4a2a',
    skyMid: '#d69a55',
    skyBottom: '#f7d9a0',
    sun: { x: 0.3, y: 0.36, r: 0.05, color: '#fff3d0', glow: 'rgba(255, 220, 150, 0.5)' },
    stars: false,
    layers: [
      { kind: 'dunes', color: '#d39a5c', rim: '#ffe2b0', parallax: 0.06, base: 0.7, height: 0.2, seed: 4 },
      { kind: 'dunes', color: '#bb7c44', rim: '#ffd39a', parallax: 0.16, base: 0.78, height: 0.22, seed: 12 },
      { kind: 'dunes', color: '#96592e', rim: '#f5b878', parallax: 0.3, base: 0.86, height: 0.2, seed: 19 },
    ],
    haze: '240,200,150',
    ground: {
      crust: '#f0c27a',
      crustShade: '#c08a4a',
      strata: ['#d9a15e', '#c48a4c', '#a8703b', '#86552c', '#5e3a1f'],
      rim: '#fff0c8',
      grass: null,
      pebble: '#8a5a30',
      dust: '#f4d49c',
    },
    weather: 'sand',
    night: false,
    accent: '#ffb347',
    pitHazard: 'rocks',
    props: ['cactus', 'boulder', 'flag'],
  },
  stadium: {
    skyTop: '#05060f',
    skyMid: '#0e1633',
    skyBottom: '#233466',
    sun: null,
    stars: true,
    layers: [
      { kind: 'city', color: '#141c38', rim: '#3a5aa8', parallax: 0.05, base: 0.66, height: 0.22, seed: 6 },
      { kind: 'stadium', color: '#10152a', rim: '#6f8fe0', parallax: 0.16, base: 0.8, height: 0.22, seed: 10 },
    ],
    haze: '60,80,160',
    ground: {
      crust: '#7a5236',
      crustShade: '#4a2f1f',
      strata: ['#5e3d28', '#4c311f', '#3a2517', '#291a10', '#170e08'],
      rim: '#bcd3ff',
      grass: null,
      pebble: '#2a1a10',
      dust: '#9a7a60',
    },
    weather: 'confetti',
    night: true,
    accent: '#4fd8ff',
    pitHazard: 'fire',
    props: ['light', 'hay', 'tires'],
  },
};

interface MissionSpec {
  name: string;
  place: string;
  objective: Objective;
  objectiveText: string;
  briefing: string;
  build: () => TrackData;
  theme: string;
  medals: Medals;
  rivals?: RivalSpec[];
}

const SPECS: MissionSpec[] = [
  {
    name: 'CAÑÓN ROJO',
    place: 'Arizona, EE. UU.',
    objective: 'time',
    objectiveText: 'Contrarreloj: llega a meta lo antes posible',
    briefing: 'Tu primera prueba de la gira. Aprende a medir el gas en los saltos y a clavar las recepciones.',
    build: canyon,
    theme: 'canyon',
    medals: { parTime: 56, gold: 42, silver: 49 },
  },
  {
    name: 'LA CANTERA',
    place: 'Montes de León, España',
    objective: 'plates',
    objectiveText: 'Recoge las 10 placas doradas',
    briefing: 'Una cantera abandonada con fosos de diez metros. Las placas cuelgan donde da miedo ir.',
    build: quarry,
    theme: 'quarry',
    medals: { parTime: 58, gold: 44, silver: 51, silverPlates: 7, goldPlates: 10 },
  },
  {
    name: 'BOSQUE DE NIEBLA',
    place: 'Selva Negra, Alemania',
    objective: 'tricks',
    objectiveText: 'Haz trucos: mortales y combos',
    briefing: 'Saltos largos entre troncos y niebla. Gira en el aire y clava la recepción para encadenar.',
    build: forest,
    theme: 'forest',
    medals: { parTime: 56, gold: 41, silver: 48, silverScore: 5000, goldScore: 12000 },
  },
  {
    name: 'TORMENTA DE ARENA',
    place: 'Erg Chebbi, Marruecos',
    objective: 'storm',
    objectiveText: 'Que no te alcance la tormenta',
    briefing: 'Un muro de arena avanza por el desierto y no eres el único que huye: tres rivales corren contigo. Al que se caiga, se lo traga la tormenta.',
    build: dunes,
    theme: 'dunes',
    medals: { parTime: 54, gold: 40, silver: 47 },
    rivals: [
      { name: 'DUARTE', number: '8', colors: 'yellow', pace: 18.5, reaction: 0.22, sloppiness: 0.04, lane: 1 },
      { name: 'OKAFOR', number: '12', colors: 'green', pace: 19.5, reaction: 0.3, sloppiness: 0.02, lane: 2 },
      { name: 'LINDQVIST', number: '41', colors: 'blue', pace: 17.5, reaction: 0.18, sloppiness: 0.06, lane: 3 },
    ],
  },
  {
    name: 'ESTADIO NOCTURNO',
    place: 'Gran Final, París',
    objective: 'final',
    objectiveText: 'La final: gana a los tres rivales',
    briefing: 'Supercross bajo los focos contra los tres mejores de la gira. Da gas justo antes de que caiga la parrilla, gana el holeshot y aguanta hasta el salto de fuego.',
    build: stadium,
    theme: 'stadium',
    medals: { parTime: 55, gold: 41, silver: 48 },
    rivals: [
      { name: 'KOVAČ', number: '23', colors: 'blue', pace: 20, reaction: 0.16, sloppiness: 0.02, lane: 1 },
      { name: 'MORENO', number: '5', colors: 'purple', pace: 21, reaction: 0.24, sloppiness: 0.01, lane: 2 },
      { name: 'DUARTE', number: '8', colors: 'yellow', pace: 19, reaction: 0.2, sloppiness: 0.04, lane: 3 },
    ],
  },
];

export const MISSION_COUNT = SPECS.length;

const cache = new Map<number, Mission>();

export function getMission(id: number): Mission {
  const cached = cache.get(id);
  if (cached) return cached;
  const spec = SPECS[id - 1];
  if (!spec) throw new Error(`Mision ${id} no existe`);
  const mission: Mission = {
    id,
    name: spec.name,
    place: spec.place,
    objective: spec.objective,
    objectiveText: spec.objectiveText,
    briefing: spec.briefing,
    track: spec.build(),
    theme: THEMES[spec.theme],
    medals: spec.medals,
    rivals: spec.rivals ?? [],
  };
  alignAirPickups(mission);
  cache.set(id, mission);
  return mission;
}

export function missionSummaries(): Array<{ id: number; name: string; place: string; objectiveText: string; accent: string }> {
  return SPECS.map((s, i) => ({ id: i + 1, name: s.name, place: s.place, objectiveText: s.objectiveText, accent: THEMES[s.theme].accent }));
}

export interface RaceResult {
  finished: boolean;
  time: number;
  trickScore: number;
  plates: number;
  crashes: number;
  /** Puesto final (solo en pruebas con rivales). */
  position?: number;
}

/** 0 = sin medalla, 1 bronce, 2 plata, 3 oro. */
export function medalFor(m: Mission, r: RaceResult): number {
  if (!r.finished) return 0;
  const md = m.medals;
  if (m.objective === 'tricks') {
    if (r.trickScore >= (md.goldScore ?? Infinity)) return 3;
    if (r.trickScore >= (md.silverScore ?? Infinity)) return 2;
    return 1;
  }
  if (m.objective === 'plates') {
    if (r.plates >= (md.goldPlates ?? 99) && r.time <= md.gold) return 3;
    if (r.plates >= (md.silverPlates ?? 99) && r.time <= md.silver) return 2;
    return 1;
  }
  if (m.objective === 'final') {
    const pos = r.position ?? 99;
    return pos === 1 ? 3 : pos === 2 ? 2 : 1;
  }
  if (r.time <= md.gold) return 3;
  if (r.time <= md.silver) return 2;
  return 1;
}
