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
import { TrackDefinition } from '../tracks/CanyonRun';
import { BikeState, wheelVisualCenterWorld } from '../physics/Bike';
import { Camera } from './Camera';
import { ParticleSystem } from './ParticleSystem';
import { SpriteDecals } from './SpriteDecals';
import { BikeConfig, SuspensionConfig } from '../config/GameConfig';
import { Vec2, rotateVec } from '../physics/MathUtils';
import { SpriteImages, SpriteCalibration } from './SpriteAssets';

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
 * Paleta del entorno: tonos tierra/roca/cielo de un canon de motocross. La
 * moto y el piloto ya no se dibujan vectorialmente (ver SpriteAssets.ts):
 * son PNG reales generados a partir del key art de la marca.
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
    track: TrackDefinition;
    bike: BikeState;
    particles: ParticleSystem;
    decals: SpriteDecals;
    flowValue: number;
    isRedline: boolean;
    crashed: boolean;
  }): void {
    const { ctx, canvas } = this;
    const { camera, track, bike, particles, decals, isRedline, crashed } = opts;
    const terrain = track.terrain;
    const shake = camera.getShakeOffset();

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawSky(camera);
    this.drawBackdrop(camera, terrain, shake);
    this.drawTerrain(camera, terrain, shake);
    this.drawTrackProps(camera, terrain, shake);
    this.drawTrackGates(camera, track, shake);
    this.drawParticles(camera, particles, shake);
    this.drawDecals(camera, decals, shake);
    this.drawBike(camera, bike, isRedline, crashed, shake);

    ctx.restore();
  }

  /** Dibuja un sprite anclado por su centro-inferior a un punto del suelo. */
  private drawGroundSprite(
    camera: Camera,
    terrain: Terrain,
    shake: Vec2,
    x: number,
    widthMeters: number,
    image: HTMLImageElement,
  ): void {
    if (!image.complete || image.naturalWidth === 0) return;
    const scale = (widthMeters * camera.pixelsPerMeter) / image.naturalWidth;
    const groundY = terrain.surfaceY(x);
    const p = this.worldToScreen(camera, x, groundY, shake);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    this.ctx.drawImage(image, p.x - w / 2, p.y - h, w, h);
  }

  /** Nombres de sector que empiezan con un salto: ahi va el cartel de "JUMP", no un arco de checkpoint. */
  private static readonly JUMP_SECTORS = new Set([
    'JUMP_SIMPLE',
    'DOUBLE_JUMP',
    'RISK_LINE_JUMP',
    'BIG_TRIPLE',
    'MEGA_JUMP',
  ]);

  /**
   * Arcos y carteles de la pista: salida al principio, un cartel de "JUMP"
   * al entrar en cada tramo de salto (telegrafia lo que viene, no solo
   * decora), un arco de checkpoint en el resto de sectores intermedios, y
   * el arco de meta al final.
   */
  private drawTrackGates(camera: Camera, track: TrackDefinition, shake: Vec2): void {
    const { terrain, labels } = track;
    this.drawGroundSprite(camera, terrain, shake, track.startX, 9, SpriteImages.startGate);
    for (const label of labels) {
      if (label.name === 'START' || label.name === 'FINISH') continue;
      if (Renderer.JUMP_SECTORS.has(label.name)) {
        this.drawGroundSprite(camera, terrain, shake, label.x - 3, 5.5, SpriteImages.jumpSign);
      } else {
        this.drawGroundSprite(camera, terrain, shake, label.x, 8, SpriteImages.checkpointGate);
      }
    }
    this.drawGroundSprite(camera, terrain, shake, terrain.endX, 11, SpriteImages.finishGate);
  }

  /**
   * Decoracion suelta a lo largo de la pista: bloques de neumaticos, rocas y
   * banderolas, intercalados de forma deterministica (mismo aspecto cada
   * frame). Mas espaciados que los matojos de drawTerrain -son piezas
   * grandes, no relleno-.
   */
  private drawTrackProps(camera: Camera, terrain: Terrain, shake: Vec2): void {
    const ppm = camera.pixelsPerMeter;
    const halfWidthMeters = this.canvas.width / 2 / ppm;
    const startX = Math.max(terrain.startX, camera.x - halfWidthMeters - 6);
    const endX = Math.min(terrain.endX, camera.x + halfWidthMeters + 6);
    const spacing = 26;
    const firstSlot = Math.floor(startX / spacing) * spacing;
    const props: Array<{ image: HTMLImageElement; widthMeters: number }> = [
      { image: SpriteImages.barrier, widthMeters: 4.2 },
      { image: SpriteImages.rockClusterA, widthMeters: 4.5 },
      { image: SpriteImages.rockClusterB, widthMeters: 4.5 },
      { image: SpriteImages.bannerFlag, widthMeters: 1.6 },
      { image: SpriteImages.cactusCluster, widthMeters: 2.6 },
      { image: SpriteImages.fenceBanner, widthMeters: 5.5 },
    ];
    for (let slot = firstSlot; slot <= endX; slot += spacing) {
      const r = hash(slot * 0.091);
      if (r < 0.25) continue; // hueco: no todos los tramos llevan decoracion
      const prop = props[Math.floor(hash(slot * 0.133) * props.length) % props.length];
      const x = slot + (hash(slot * 0.211) - 0.5) * spacing * 0.4;
      if (x < terrain.startX + 6 || x > terrain.endX - 6) continue;
      this.drawGroundSprite(camera, terrain, shake, x, prop.widthMeters, prop.image);
    }
  }

  private drawDecals(camera: Camera, decals: SpriteDecals, shake: Vec2): void {
    const { ctx } = this;
    decals.forEachAlive((x, y, alpha, image) => {
      if (!image.complete || image.naturalWidth === 0) return;
      const p = this.worldToScreen(camera, x, y, shake);
      const widthMeters = 3.2 * (1.15 - alpha * 0.15);
      const scale = (widthMeters * camera.pixelsPerMeter) / image.naturalWidth;
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      ctx.globalAlpha = alpha * 0.85;
      ctx.drawImage(image, p.x - w / 2, p.y - h * 0.75, w, h);
    });
    ctx.globalAlpha = 1;
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

  /**
   * Dibuja una imagen "rigidamente atornillada" al chasis: se traslada a un
   * punto de pantalla, se rota como el resto de la moto y se escala de forma
   * uniforme, de modo que un pixel de la imagen fuente representa siempre la
   * misma distancia en metros (parametro `scale`, pixeles de pantalla por
   * pixel de imagen). `pivotPx` es el punto de la imagen (en pixeles nativos)
   * que debe caer exactamente en `screenPos`.
   */
  private drawRigidSprite(
    image: HTMLImageElement,
    screenPos: { x: number; y: number },
    angle: number,
    pivotPx: { x: number; y: number },
    scale: number,
  ): void {
    if (!image.complete || image.naturalWidth === 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(-angle);
    ctx.drawImage(image, -pivotPx.x * scale, -pivotPx.y * scale, image.naturalWidth * scale, image.naturalHeight * scale);
    ctx.restore();
  }

  private drawBike(camera: Camera, bike: BikeState, isRedline: boolean, crashed: boolean, shake: Vec2): void {
    const wb = BikeConfig.wheelBase;
    const { rearAxlePx, frontAxlePx } = SpriteCalibration.bike;

    // Un solo factor de escala para toda la moto (chasis + ambas ruedas):
    // vienen de la misma foto original, asi que comparten los mismos
    // pixeles-por-metro nativos. Lo calibramos con la distancia entre ejes
    // de la imagen, que es la referencia mas fiable (ver assets-src/).
    const spritePxPerMeter = (frontAxlePx.x - rearAxlePx.x) / wb;
    const scale = camera.pixelsPerMeter / spritePxPerMeter;

    const frontWheelW = wheelVisualCenterWorld(bike, 'front');
    const rearWheelW = wheelVisualCenterWorld(bike, 'rear');

    // Filtro de color para REDLINE/crash: como ahora son fotos y no vectores,
    // en vez de recolorear geometria aplicamos un filtro de canvas sobre
    // cada sprite de la moto (no sobre el fondo).
    const filter = crashed ? 'grayscale(0.7) brightness(0.75)' : isRedline ? 'saturate(1.4) hue-rotate(-8deg)' : 'none';
    this.ctx.save();
    this.ctx.filter = filter;

    // Ruedas primero (el chasis las tapa parcialmente por arriba, como en
    // la foto original: guardabarros/horquilla por delante del neumatico).
    this.drawRigidSprite(
      SpriteImages.wheelRear,
      this.worldToScreen(camera, rearWheelW.x, rearWheelW.y, shake),
      bike.angle,
      SpriteCalibration.wheelRear.pivotPx,
      scale,
    );
    this.drawRigidSprite(
      SpriteImages.wheelFront,
      this.worldToScreen(camera, frontWheelW.x, frontWheelW.y, shake),
      bike.angle,
      SpriteCalibration.wheelFront.pivotPx,
      scale,
    );

    // Chasis completo (deposito, asiento, carenados, motor, escape): una
    // sola imagen rigida anclada por el punto medio del eje de ruedas. El
    // pixel del eje en la foto es el centro de la RUEDA EN REPOSO, que
    // cuelga del anclaje de la horquilla una distancia = restLength de la
    // suspension (ver Bike.wheelVisualCenterWorld); hay que sumarla a
    // comHeight o el chasis queda flotando por encima de donde deberia.
    const restLengthAvg = (SuspensionConfig.front.restLength + SuspensionConfig.rear.restLength) / 2;
    const comPixel = {
      x: (rearAxlePx.x + frontAxlePx.x) / 2,
      y: rearAxlePx.y - (BikeConfig.comHeight + restLengthAvg) * spritePxPerMeter,
    };
    const comScreen = this.worldToScreen(camera, bike.x, bike.y, shake);
    this.drawRigidSprite(SpriteImages.bikeBody, comScreen, bike.angle, comPixel, scale);

    this.ctx.restore();

    // Piloto: sentado sobre el asiento (punto fijo en espacio local del
    // chasis), con su propia escala derivada de una altura asumida en
    // cuclillas -sigue rotando en bloque con la moto-.
    this.drawRider(camera, bike, shake, crashed, isRedline);
  }

  private drawRider(camera: Camera, bike: BikeState, shake: Vec2, crashed: boolean, isRedline: boolean): void {
    // Punto del asiento en espacio local del chasis (metros desde el CoM),
    // derivado del pixel del asiento en bike_body.png (~260,160) con la
    // misma calibracion eje/escala que usa el chasis (ver drawBike): el CoM
    // fisico (comHeight+restLength por encima de la rueda en reposo) cae
    // bastante mas arriba que el asiento visual, de ahi el valor negativo.
    const seatLocal: Vec2 = { x: -0.25, y: -0.63 };
    const seatScreen = this.localToScreen(camera, bike, shake, seatLocal);

    const riderImg = SpriteImages.rider;
    const riderPxPerMeter = riderImg.naturalHeight / SpriteCalibration.rider.assumedHeightMeters;
    const scale = riderPxPerMeter > 0 ? camera.pixelsPerMeter / riderPxPerMeter : 0;

    const filter = crashed ? 'grayscale(0.7) brightness(0.75)' : isRedline ? 'saturate(1.4) hue-rotate(-8deg)' : 'none';
    this.ctx.save();
    this.ctx.filter = filter;
    this.drawRigidSprite(riderImg, seatScreen, bike.angle, SpriteCalibration.rider.hipPivotPx, scale);
    this.ctx.restore();
  }
}
