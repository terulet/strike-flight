/**
 * Renderer.ts
 *
 * Dibuja el mundo (cielo, canon de fondo, terreno, moto, particulas) en un
 * canvas 2D usando la camara para transformar coordenadas de mundo (metros,
 * Y hacia arriba) a coordenadas de pantalla (pixeles, Y hacia abajo).
 *
 * Tema visual: cantera / canon de motocross. Paleta de tierra, arena, roca
 * y cielo calido de tarde, con vegetacion muy escasa. Programmer art
 * deliberado (sin sprites), pero con suficiente lectura de forma para que
 * el chasis, las ruedas y la suspension se "sientan" al jugar.
 */

import { Terrain } from '../physics/Terrain';
import { BikeState, wheelAnchorWorld, wheelVisualCenterWorld } from '../physics/Bike';
import { Camera } from './Camera';
import { ParticleSystem } from './ParticleSystem';
import { BikeConfig } from '../config/GameConfig';
import { Vec2, rotateVec } from '../physics/MathUtils';

/** Traduce un punto en espacio local del chasis (x=adelante, y=arriba, origen en el centro de masas) a mundo. */
function localToWorld(bike: BikeState, local: Vec2): Vec2 {
  const r = rotateVec(local, bike.angle);
  return { x: bike.x + r.x, y: bike.y + r.y };
}

/** Ruido pseudoaleatorio determinista (mismo input -> mismo output cada frame, sin parpadeos). */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Paleta de marca: naranja/negro/rojo sobre canon de tierra, alineada con el
 * key art de CROSS RUSH (casco y mono naranja quemado, chasis blanco/plata,
 * acentos rojos en REDLINE). El entorno se queda en tonos tierra/roca
 * naturales; lo que cambia de marca es la moto, el piloto y la UI.
 */
const PALETTE = {
  skyTop: '#3c5a78',
  skyHorizon: '#f0b874',
  sunGlow: 'rgba(255, 214, 150, 0.35)',
  farMountain: '#6b4f5e',
  nearMountain: '#8a5a4a',
  rockDark: '#4a3323',
  rockMid: '#6b4a30',
  soilTop: '#a9744a',
  soilRim: '#e0aa6a',
  scrub: '#5c6b3e',
  bikeFrame: '#eef0f4',
  bikeFrameRedline: '#ffd9c2',
  bikeAccent: '#ff6a1a',
  bikeAccentRedline: '#ff2d2d',
  riderSuit: '#ff6a1a',
  riderSuitRedline: '#ff2d2d',
  riderHelmet: '#181410',
  tire: '#1b1b1f',
  rim: '#c9ccd4',
  dust: '#d9c4a0',
} as const;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');
    this.ctx = ctx;
  }

  resizeToDisplaySize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private worldToScreen(camera: Camera, wx: number, wy: number, shake: Vec2): { x: number; y: number } {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const ppm = camera.pixelsPerMeter;
    return {
      x: cx + (wx - camera.x + shake.x) * ppm,
      y: cy - (wy - camera.y + shake.y) * ppm,
    };
  }

  render(opts: {
    camera: Camera;
    terrain: Terrain;
    bike: BikeState;
    particles: ParticleSystem;
    flowValue: number;
    isRedline: boolean;
    crashed: boolean;
  }): void {
    const { ctx, canvas } = this;
    const { camera, terrain, bike, particles, isRedline, crashed } = opts;
    const shake = camera.getShakeOffset();

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawSky(camera);
    this.drawBackdrop(camera, terrain, shake);
    this.drawTerrain(camera, terrain, shake);
    this.drawParticles(camera, particles, shake);
    this.drawBike(camera, bike, isRedline, crashed, shake);

    ctx.restore();
  }

  private drawSky(camera: Camera): void {
    const { ctx, canvas } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.65, PALETTE.skyHorizon);
    sky.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Resplandor de sol bajo, fijo respecto a la camara para dar sensacion de
    // "tarde en el canon" sin que se note que en realidad no hay sol real.
    const glow = ctx.createRadialGradient(
      canvas.width * 0.72,
      canvas.height * 0.42,
      0,
      canvas.width * 0.72,
      canvas.height * 0.42,
      canvas.width * 0.5,
    );
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    void camera;
  }

  /** Capas de montanas/mesetas lejanas con parallax, para dar profundidad al canon. */
  private drawBackdrop(camera: Camera, terrain: Terrain, shake: Vec2): void {
    const { ctx, canvas } = this;
    const layers: Array<{ parallax: number; color: string; baseFrac: number; amp: number; seed: number }> = [
      { parallax: 0.12, color: PALETTE.farMountain, baseFrac: 0.62, amp: 0.16, seed: 11 },
      { parallax: 0.28, color: PALETTE.nearMountain, baseFrac: 0.7, amp: 0.13, seed: 47 },
    ];

    for (const layer of layers) {
      const worldOffsetX = camera.x * layer.parallax;
      const segment = 14;
      const startIdx = Math.floor((worldOffsetX - canvas.width) / segment) - 1;
      const endIdx = Math.ceil((worldOffsetX + canvas.width) / segment) + 1;

      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let i = startIdx; i <= endIdx; i++) {
        const wx = i * segment;
        const screenX = canvas.width / 2 + (wx - worldOffsetX) * camera.pixelsPerMeter * 0.6;
        const h = layer.baseFrac + (hash(i + layer.seed) - 0.5) * layer.amp;
        const screenY = canvas.height * h;
        ctx.lineTo(screenX, screenY);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.globalAlpha = 0.55;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    void terrain;
    void shake;
  }

  private drawTerrain(camera: Camera, terrain: Terrain, shake: Vec2): void {
    const { ctx, canvas } = this;
    const ppm = camera.pixelsPerMeter;
    const halfWidthMeters = canvas.width / 2 / ppm;
    const startX = Math.max(terrain.startX, camera.x - halfWidthMeters - 4);
    const endX = Math.min(terrain.endX, camera.x + halfWidthMeters + 4);
    const step = Math.max(0.15, 1 / ppm);

    const surfacePoints: { x: number; y: number; p: { x: number; y: number } }[] = [];
    for (let x = startX; x <= endX; x += step) {
      const y = terrain.surfaceY(x);
      surfacePoints.push({ x, y, p: this.worldToScreen(camera, x, y, shake) });
    }
    if (surfacePoints.length < 2) return;

    // Relleno de tierra bajo la superficie, con vetas de roca en capas.
    ctx.beginPath();
    ctx.moveTo(surfacePoints[0].p.x, surfacePoints[0].p.y);
    for (const sp of surfacePoints) ctx.lineTo(sp.p.x, sp.p.y);
    ctx.lineTo(surfacePoints[surfacePoints.length - 1].p.x, canvas.height);
    ctx.lineTo(surfacePoints[0].p.x, canvas.height);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, canvas.height * 0.35, 0, canvas.height);
    fill.addColorStop(0, PALETTE.soilTop);
    fill.addColorStop(0.35, PALETTE.rockMid);
    fill.addColorStop(1, PALETTE.rockDark);
    ctx.fillStyle = fill;
    ctx.fill();

    // Vetas de roca: un par de lineas onduladas por debajo de la superficie.
    ctx.lineWidth = 1.5;
    for (const depth of [1.2, 2.6]) {
      ctx.beginPath();
      let first = true;
      for (const sp of surfacePoints) {
        const p = this.worldToScreen(camera, sp.x, sp.y - depth, shake);
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.stroke();
    }

    // Linea de cresta iluminada (rim light) sobre la superficie.
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.soilRim;
    ctx.beginPath();
    surfacePoints.forEach((sp, i) => (i === 0 ? ctx.moveTo(sp.p.x, sp.p.y) : ctx.lineTo(sp.p.x, sp.p.y)));
    ctx.stroke();

    // Vegetacion muy escasa: matojos secos cada pocos metros, solo si el
    // hueco es lo bastante ancho para no amontonarse en curvas cerradas.
    const scrubSpacing = 9;
    const firstBush = Math.floor(startX / scrubSpacing) * scrubSpacing;
    for (let wx = firstBush; wx <= endX; wx += scrubSpacing) {
      if (hash(wx * 0.37) < 0.45) continue;
      const wy = terrain.surfaceY(wx);
      const p = this.worldToScreen(camera, wx, wy, shake);
      const scale = 0.6 + hash(wx) * 0.5;
      this.drawScrub(p.x, p.y, scale);
    }
  }

  private drawScrub(x: number, y: number, scale: number): void {
    const { ctx } = this;
    ctx.strokeStyle = PALETTE.scrub;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    for (const dir of [-1, -0.4, 0.4, 1]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * 6 * scale, y - 10 * scale);
    }
    ctx.stroke();
  }

  private drawParticles(camera: Camera, particles: ParticleSystem, shake: Vec2): void {
    const { ctx } = this;
    particles.forEachAlive((x, y, alpha, size) => {
      const p = this.worldToScreen(camera, x, y, shake);
      ctx.globalAlpha = alpha * 0.65;
      ctx.fillStyle = PALETTE.dust;
      const r = size * camera.pixelsPerMeter;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private drawBike(camera: Camera, bike: BikeState, isRedline: boolean, crashed: boolean, shake: Vec2): void {
    const { ctx } = this;
    const ppm = camera.pixelsPerMeter;
    const wb = BikeConfig.wheelBase;
    const ch = BikeConfig.comHeight;

    const frontAnchor = wheelAnchorWorld(bike, 'front');
    const rearAnchor = wheelAnchorWorld(bike, 'rear');
    const frontWheel = wheelVisualCenterWorld(bike, 'front');
    const rearWheel = wheelVisualCenterWorld(bike, 'rear');

    const frameColor = crashed ? '#8a8a90' : isRedline ? PALETTE.bikeFrameRedline : PALETTE.bikeFrame;
    const accentColor = crashed ? '#5c5c60' : isRedline ? PALETTE.bikeAccentRedline : PALETTE.bikeAccent;

    // --- Horquilla delantera y basculante trasero: lineas del anclaje a la
    // rueda. Su longitud visible cambia con la compresion real de la
    // suspension, asi que un aterrizaje fuerte se ve "tragarse" recorrido. ---
    ctx.lineWidth = Math.max(2, 0.06 * ppm);
    ctx.strokeStyle = accentColor;
    for (const [anchor, wheel] of [
      [frontAnchor, frontWheel],
      [rearAnchor, rearWheel],
    ] as const) {
      const a = this.worldToScreen(camera, anchor.x, anchor.y, shake);
      const w = this.worldToScreen(camera, wheel.x, wheel.y, shake);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
    }

    // --- Chasis: silueta poligonal en espacio local del chasis (x=adelante,
    // y=arriba, origen en el centro de masas), rotada como un solo bloque.
    // Va desde la altura de los anclajes de rueda hasta por encima del CoM,
    // para que se lea como un chasis de motocross real y no como una cuna. ---
    const seatLocal = { x: -wb * 0.14, y: ch * 0.32 };
    const headTubeLocal = { x: wb * 0.4, y: ch * 0.2 };
    const footpegLocal = { x: -wb * 0.04, y: -ch * 0.3 };
    const rearAxleLocal = { x: -wb / 2, y: -ch };
    const frontAxleLocal = { x: wb / 2, y: -ch };

    const framePts = [rearAxleLocal, seatLocal, headTubeLocal, frontAxleLocal, footpegLocal].map((p) => {
      const w = localToWorld(bike, p);
      return this.worldToScreen(camera, w.x, w.y, shake);
    });

    ctx.beginPath();
    framePts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = frameColor;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 0.03 * ppm);
    ctx.strokeStyle = crashed ? '#3a3a3f' : '#233046';
    ctx.stroke();

    // --- Piloto: figura minima (casco + torso + brazo + pierna) apoyada en
    // el asiento, siguiendo la rotacion del chasis. Reconocible sin ser un
    // sprite: es lo que pide el brief para M1. ---
    this.drawRider(camera, bike, shake, crashed, isRedline);

    // --- Ruedas: neumatico con tacos y llanta con radios que giran segun la
    // distancia recorrida (rodadura aproximada, suficiente para el feel). ---
    const wheelR = BikeConfig.wheelRadius * ppm;
    const spinFront = (frontWheel.x / Math.max(0.05, BikeConfig.wheelRadius)) % (Math.PI * 2);
    const spinRear = (rearWheel.x / Math.max(0.05, BikeConfig.wheelRadius)) % (Math.PI * 2);
    for (const [wheel, contact, spin] of [
      [frontWheel, bike.front.inContact, spinFront] as const,
      [rearWheel, bike.rear.inContact, spinRear] as const,
    ]) {
      const wp = this.worldToScreen(camera, wheel.x, wheel.y, shake);
      this.drawWheel(wp.x, wp.y, wheelR, spin, contact, crashed);
    }
  }

  private drawRider(camera: Camera, bike: BikeState, shake: Vec2, crashed: boolean, isRedline: boolean): void {
    const { ctx } = this;
    const ppm = camera.pixelsPerMeter;
    const wb = BikeConfig.wheelBase;
    const ch = BikeConfig.comHeight;

    // Puntos en espacio local del chasis: cadera sobre el asiento, hombro
    // adelantado y arriba (postura de ataque), casco por encima del hombro,
    // mano en el manillar (por encima del tubo de direccion) y pie en el
    // estribo. Todo rota como un bloque junto con el chasis.
    const hip = { x: -wb * 0.12, y: ch * 0.4 };
    const shoulder = { x: wb * 0.06, y: ch * 1.05 };
    const helmet = { x: wb * 0.16, y: ch * 1.4 };
    const hand = { x: wb * 0.42, y: ch * 0.85 };
    const foot = { x: -wb * 0.02, y: -ch * 0.28 };

    const toScreen = (local: Vec2) => {
      const w = localToWorld(bike, local);
      return this.worldToScreen(camera, w.x, w.y, shake);
    };
    const pHip = toScreen(hip);
    const pShoulder = toScreen(shoulder);
    const pHelmet = toScreen(helmet);
    const pHand = toScreen(hand);
    const pFoot = toScreen(foot);

    ctx.strokeStyle = crashed ? '#3a3a3f' : isRedline ? PALETTE.riderSuitRedline : PALETTE.riderSuit;
    ctx.lineCap = 'round';

    // Pierna: cadera -> estribo.
    ctx.lineWidth = Math.max(2.5, 0.06 * ppm);
    ctx.beginPath();
    ctx.moveTo(pHip.x, pHip.y);
    ctx.lineTo(pFoot.x, pFoot.y);
    ctx.stroke();

    // Torso: cadera -> hombro.
    ctx.lineWidth = Math.max(3.5, 0.09 * ppm);
    ctx.beginPath();
    ctx.moveTo(pHip.x, pHip.y);
    ctx.lineTo(pShoulder.x, pShoulder.y);
    ctx.stroke();

    // Brazo: hombro -> manillar.
    ctx.lineWidth = Math.max(2.5, 0.06 * ppm);
    ctx.beginPath();
    ctx.moveTo(pShoulder.x, pShoulder.y);
    ctx.lineTo(pHand.x, pHand.y);
    ctx.stroke();

    // Casco: base oscura con una franja de la marca (naranja o roja en
    // REDLINE) para que se lea el kit incluso a este tamano tan pequeno.
    const helmetR = Math.max(5, 0.2 * ppm);
    ctx.beginPath();
    ctx.fillStyle = crashed ? '#5c5c60' : PALETTE.riderHelmet;
    ctx.arc(pHelmet.x, pHelmet.y, helmetR, 0, Math.PI * 2);
    ctx.fill();
    if (!crashed) {
      ctx.beginPath();
      ctx.fillStyle = isRedline ? PALETTE.riderSuitRedline : PALETTE.riderSuit;
      ctx.arc(pHelmet.x, pHelmet.y, helmetR, -0.5, 0.5);
      ctx.arc(pHelmet.x, pHelmet.y, helmetR * 0.55, 0.5, -0.5, true);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawWheel(cx: number, cy: number, r: number, spin: number, contact: boolean, crashed: boolean): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.fillStyle = crashed ? '#2a2a2e' : PALETTE.tire;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Tacos del neumatico (marcas radiales), giran con el avance de la moto.
    const knobs = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (let i = 0; i < knobs; i++) {
      const a = spin + (i / knobs) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
      ctx.lineTo(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02);
      ctx.stroke();
    }

    // Llanta con radios.
    ctx.strokeStyle = contact ? PALETTE.rim : 'rgba(201,204,212,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.1);
    for (let i = 0; i < 5; i++) {
      const a = spin + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.strokeStyle = contact ? '#111' : '#444';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
}
