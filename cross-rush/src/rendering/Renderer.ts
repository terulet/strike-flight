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

  /** Punto en espacio local del chasis -> coordenadas de pantalla, en un solo paso. */
  private localToScreen(camera: Camera, bike: BikeState, shake: Vec2, local: Vec2): { x: number; y: number } {
    const w = localToWorld(bike, local);
    return this.worldToScreen(camera, w.x, w.y, shake);
  }

  /** Relleno (y opcionalmente contorno) de un poligono dado en puntos locales del chasis. */
  private fillLocalPolygon(
    camera: Camera,
    bike: BikeState,
    shake: Vec2,
    points: Vec2[],
    fillStyle: string,
    strokeStyle?: string,
    lineWidth = 1,
  ): void {
    const { ctx } = this;
    const pts = points.map((p) => this.localToScreen(camera, bike, shake, p));
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
    }
  }

  /** Circulo relleno en un punto local (nudillos de articulacion, guante...), radio en metros. */
  private fillLocalCircle(
    camera: Camera,
    bike: BikeState,
    shake: Vec2,
    center: Vec2,
    radiusMeters: number,
    fillStyle: string,
  ): void {
    const { ctx } = this;
    const p = this.localToScreen(camera, bike, shake, center);
    ctx.beginPath();
    ctx.fillStyle = fillStyle;
    ctx.arc(p.x, p.y, Math.max(1, radiusMeters * camera.pixelsPerMeter), 0, Math.PI * 2);
    ctx.fill();
  }

  /** Quad fino entre dos puntos locales (horquilla, basculante, tubo de escape...), con ancho en metros. */
  private fillLocalBar(
    camera: Camera,
    bike: BikeState,
    shake: Vec2,
    from: Vec2,
    to: Vec2,
    width: number,
    fillStyle: string,
    strokeStyle?: string,
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.max(1e-6, Math.hypot(dx, dy));
    const nx = (-dy / len) * (width / 2);
    const ny = (dx / len) * (width / 2);
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [
        { x: from.x + nx, y: from.y + ny },
        { x: to.x + nx, y: to.y + ny },
        { x: to.x - nx, y: to.y - ny },
        { x: from.x - nx, y: from.y - ny },
      ],
      fillStyle,
      strokeStyle,
      Math.max(1, width * 8),
    );
  }

  private drawBike(camera: Camera, bike: BikeState, isRedline: boolean, crashed: boolean, shake: Vec2): void {
    const wb = BikeConfig.wheelBase;
    const ch = BikeConfig.comHeight;

    const frontAnchorW = wheelAnchorWorld(bike, 'front');
    const rearAnchorW = wheelAnchorWorld(bike, 'rear');
    const frontWheelW = wheelVisualCenterWorld(bike, 'front');
    const rearWheelW = wheelVisualCenterWorld(bike, 'rear');
    // wheelAnchorWorld/wheelVisualCenterWorld ya rotan por bike.angle; para
    // dibujarlos junto al resto de la moto (que construimos en espacio local
    // y rotamos todo de una vez) los pasamos de vuelta a espacio local.
    const toLocal = (w: Vec2): Vec2 => {
      const dx = w.x - bike.x;
      const dy = w.y - bike.y;
      const c = Math.cos(-bike.angle);
      const s = Math.sin(-bike.angle);
      return { x: dx * c - dy * s, y: dx * s + dy * c };
    };
    const frontAnchor = toLocal(frontAnchorW);
    const rearAnchor = toLocal(rearAnchorW);
    const frontWheel = toLocal(frontWheelW);
    const rearWheel = toLocal(rearWheelW);

    const bodyColor = crashed ? '#8a8a90' : isRedline ? PALETTE.bikeFrameRedline : PALETTE.bikeFrame;
    const accentColor = crashed ? '#5c5c60' : isRedline ? PALETTE.bikeAccentRedline : PALETTE.bikeAccent;
    const metal = crashed ? '#3a3a3d' : '#2b2b2e';
    const outline = crashed ? '#3a3a3f' : '#1a1310';

    // --- Basculante trasero y horquilla delantera: barras solidas (no
    // lineas finas) desde el anclaje al centro visual real de cada rueda,
    // que se acorta con la compresion de la suspension -asi un aterrizaje
    // fuerte se ve "tragarse" recorrido de verdad. ---
    this.fillLocalBar(camera, bike, shake, rearAnchor, rearWheel, ch * 0.22, metal, outline);
    this.fillLocalBar(camera, bike, shake, frontAnchor, frontWheel, ch * 0.16, PALETTE.rim, outline);
    this.fillLocalBar(camera, bike, shake, frontAnchor, frontWheel, ch * 0.16 * 0.55, metal, undefined);

    // --- Motor: bloque solido entre ambas ruedas, con la culata como un
    // circulo mas claro para dar volumen. ---
    const engineCenter = { x: -wb * 0.06, y: -ch * 0.55 };
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [
        { x: engineCenter.x - wb * 0.16, y: engineCenter.y - ch * 0.28 },
        { x: engineCenter.x + wb * 0.14, y: engineCenter.y - ch * 0.3 },
        { x: engineCenter.x + wb * 0.2, y: engineCenter.y + ch * 0.22 },
        { x: engineCenter.x - wb * 0.12, y: engineCenter.y + ch * 0.3 },
      ],
      metal,
      outline,
      2,
    );
    {
      const { ctx } = this;
      const p = this.localToScreen(camera, bike, shake, { x: engineCenter.x + wb * 0.04, y: engineCenter.y + ch * 0.05 });
      ctx.beginPath();
      ctx.fillStyle = crashed ? '#55555a' : '#4a4a50';
      ctx.arc(p.x, p.y, Math.max(2, ch * 0.16 * camera.pixelsPerMeter), 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Escape: tubo curvo del motor hacia atras, terminando en un
    // silenciador cilindrico bajo el asiento (naranja quemado, como el
    // key art de referencia). ---
    const exhaustMid = { x: -wb * 0.28, y: -ch * 0.35 };
    const exhaustEnd = { x: -wb * 0.55, y: -ch * 0.05 };
    this.fillLocalBar(camera, bike, shake, engineCenter, exhaustMid, ch * 0.1, metal, outline);
    this.fillLocalBar(camera, bike, shake, exhaustMid, exhaustEnd, ch * 0.16, accentColor, outline);

    // --- Chasis / deposito / asiento: silueta continua desde el eje
    // trasero, subiendo al asiento, al deposito (mas alto y redondeado) y
    // bajando al tubo de direccion, en el color de carroceria de la marca. ---
    const railRear = { x: -wb * 0.42, y: -ch * 0.25 };
    const railFront = { x: wb * 0.3, y: -ch * 0.05 };
    const seatBack = { x: -wb * 0.32, y: ch * 0.28 };
    const seatFront = { x: -wb * 0.02, y: ch * 0.34 };
    const tankTop = { x: wb * 0.14, y: ch * 0.92 };
    const headTube = { x: wb * 0.4, y: ch * 0.28 };
    // Silueta cerrada a media altura (no baja hasta el eje de las ruedas,
    // para no tapar el motor/escape que se dibujan debajo): raiz trasera ->
    // asiento -> deposito -> tubo de direccion -> raiz delantera.
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [railRear, seatBack, seatFront, tankTop, headTube, railFront],
      bodyColor,
      outline,
      2,
    );

    // --- Carenado/radiador: cuna de color de marca alrededor del tubo de
    // direccion, como los plasticos naranjas del key art. ---
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [
        { x: wb * 0.16, y: ch * 0.55 },
        { x: wb * 0.4, y: ch * 0.3 },
        { x: wb * 0.34, y: -ch * 0.15 },
        { x: wb * 0.1, y: -ch * 0.05 },
      ],
      accentColor,
      outline,
      1.5,
    );

    // --- Guardabarros: acompanan a cada horquilla/basculante, dan lectura
    // inmediata de "esto es una moto de motocross". ---
    const frontFenderDir = { x: frontWheel.x - frontAnchor.x, y: frontWheel.y - frontAnchor.y };
    const frontFenderMid = { x: frontAnchor.x + frontFenderDir.x * 0.55, y: frontAnchor.y + frontFenderDir.y * 0.55 + ch * 0.22 };
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [
        { x: frontFenderMid.x - wb * 0.16, y: frontFenderMid.y - ch * 0.06 },
        { x: frontFenderMid.x + wb * 0.16, y: frontFenderMid.y + ch * 0.05 },
        { x: frontFenderMid.x + wb * 0.12, y: frontFenderMid.y + ch * 0.22 },
        { x: frontFenderMid.x - wb * 0.12, y: frontFenderMid.y + ch * 0.16 },
      ],
      accentColor,
      outline,
      1.5,
    );
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [
        { x: -wb * 0.42, y: ch * 0.3 },
        { x: -wb * 0.2, y: ch * 0.42 },
        { x: -wb * 0.22, y: ch * 0.58 },
        { x: -wb * 0.44, y: ch * 0.48 },
      ],
      accentColor,
      outline,
      1.5,
    );

    // --- Piloto: encima del asiento/deposito, con el chasis ya dibujado
    // debajo para que las piernas se apoyen visualmente en el estribo. ---
    this.drawRider(camera, bike, shake, crashed, isRedline);

    // --- Ruedas: neumatico con tacos y llanta con radios que giran segun la
    // distancia recorrida (rodadura aproximada, suficiente para el feel). ---
    const wheelR = BikeConfig.wheelRadius * camera.pixelsPerMeter;
    const spinFront = (frontWheelW.x / Math.max(0.05, BikeConfig.wheelRadius)) % (Math.PI * 2);
    const spinRear = (rearWheelW.x / Math.max(0.05, BikeConfig.wheelRadius)) % (Math.PI * 2);
    for (const [wheelW, contact, spin, disc] of [
      [frontWheelW, bike.front.inContact, spinFront, true] as const,
      [rearWheelW, bike.rear.inContact, spinRear, false] as const,
    ]) {
      const wp = this.worldToScreen(camera, wheelW.x, wheelW.y, shake);
      this.drawWheel(wp.x, wp.y, wheelR, spin, contact, crashed, disc);
    }
  }

  private drawRider(camera: Camera, bike: BikeState, shake: Vec2, crashed: boolean, isRedline: boolean): void {
    const { ctx } = this;
    const ppm = camera.pixelsPerMeter;
    const wb = BikeConfig.wheelBase;
    const ch = BikeConfig.comHeight;
    const suit = crashed ? '#5c5c60' : isRedline ? PALETTE.riderSuitRedline : PALETTE.riderSuit;
    const suitDark = crashed ? '#3a3a3f' : '#1a1310';
    const skin = '#c98f65';

    // Puntos en espacio local del chasis: cadera sobre el asiento, hombro
    // adelantado y arriba (postura de ataque), casco por encima del hombro,
    // codo/mano hacia el manillar y rodilla/pie hacia el estribo. Todo rota
    // como un bloque junto con el chasis.
    const hip = { x: -wb * 0.1, y: ch * 0.55 };
    const knee = { x: wb * 0.18, y: -ch * 0.02 };
    const foot = { x: -wb * 0.02, y: -ch * 0.32 };
    const shoulder = { x: wb * 0.1, y: ch * 1.15 };
    const elbow = { x: wb * 0.28, y: ch * 0.92 };
    const hand = { x: wb * 0.42, y: ch * 0.78 };
    const helmet = { x: wb * 0.2, y: ch * 1.5 };

    // Muslo y pantorrilla (con volumen, no una linea), con las articulaciones
    // redondeadas para que no se note el corte recto de cada barra, y bota
    // en el pie.
    this.fillLocalBar(camera, bike, shake, hip, knee, ch * 0.24, suit, suitDark);
    this.fillLocalBar(camera, bike, shake, knee, foot, ch * 0.18, suit, suitDark);
    this.fillLocalCircle(camera, bike, shake, knee, ch * 0.11, suit);
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [
        { x: foot.x - wb * 0.07, y: foot.y + ch * 0.1 },
        { x: foot.x + wb * 0.08, y: foot.y + ch * 0.07 },
        { x: foot.x + wb * 0.06, y: foot.y - ch * 0.09 },
        { x: foot.x - wb * 0.08, y: foot.y - ch * 0.06 },
      ],
      '#2a2420',
      suitDark,
      1.5,
    );

    // Torso: cadera -> hombro, con volumen (trapecio, mas ancho arriba).
    this.fillLocalPolygon(
      camera,
      bike,
      shake,
      [
        { x: hip.x - ch * 0.18, y: hip.y - ch * 0.05 },
        { x: hip.x + ch * 0.16, y: hip.y - ch * 0.08 },
        { x: shoulder.x + ch * 0.24, y: shoulder.y },
        { x: shoulder.x - ch * 0.22, y: shoulder.y + ch * 0.05 },
      ],
      suit,
      suitDark,
      2,
    );
    // Franja pecho estilo carreras (contraste blanco/negro sobre el mono).
    this.fillLocalBar(
      camera,
      bike,
      shake,
      { x: hip.x, y: hip.y + ch * 0.12 },
      { x: shoulder.x, y: shoulder.y - ch * 0.08 },
      ch * 0.12,
      crashed ? '#4a4a4e' : '#161311',
    );

    // Brazo: hombro -> codo -> manillar, con codo redondeado y guante al final.
    this.fillLocalBar(camera, bike, shake, shoulder, elbow, ch * 0.17, suit, suitDark);
    this.fillLocalBar(camera, bike, shake, elbow, hand, ch * 0.13, suit, suitDark);
    this.fillLocalCircle(camera, bike, shake, elbow, ch * 0.09, suit);
    this.fillLocalCircle(camera, bike, shake, hand, ch * 0.11, crashed ? '#3a3a3f' : '#171310');

    // Casco: base oscura con visera y una franja de la marca (naranja o roja
    // en REDLINE), para leerse como un casco de motocross real.
    const pHelmet = this.localToScreen(camera, bike, shake, helmet);
    const helmetR = Math.max(5.5, 0.21 * ppm);
    ctx.beginPath();
    ctx.fillStyle = crashed ? '#5c5c60' : PALETTE.riderHelmet;
    ctx.arc(pHelmet.x, pHelmet.y, helmetR, 0, Math.PI * 2);
    ctx.fill();
    if (!crashed) {
      // Franja de marca en la parte superior/trasera del casco.
      ctx.beginPath();
      ctx.fillStyle = suit;
      ctx.arc(pHelmet.x, pHelmet.y, helmetR, -0.5, 0.9);
      ctx.arc(pHelmet.x, pHelmet.y, helmetR * 0.55, 0.9, -0.5, true);
      ctx.closePath();
      ctx.fill();
      // Visera/gafas: banda clara al frente del casco.
      const facing = Math.cos(bike.angle) >= 0 ? 1 : -1;
      ctx.beginPath();
      ctx.fillStyle = '#dfe6ee';
      ctx.ellipse(
        pHelmet.x + facing * helmetR * 0.35,
        pHelmet.y + helmetR * 0.05,
        helmetR * 0.55,
        helmetR * 0.32,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    void skin;
  }

  private drawWheel(
    cx: number,
    cy: number,
    r: number,
    spin: number,
    contact: boolean,
    crashed: boolean,
    withDisc: boolean,
  ): void {
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

    // Disco de freno: solo en la rueda delantera, un aro oscuro justo
    // detras de la llanta que asoma entre los radios (detalle rapido que
    // vende mucho la sensacion de "moto real").
    if (withDisc && !crashed) {
      ctx.beginPath();
      ctx.strokeStyle = '#8a8a90';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
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
