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
import { TrackDefinition, TerrainFeatureKind } from '../tracks/CanyonRun';
import { BikeState, wheelVisualCenterWorld } from '../physics/Bike';
import { CameraPose } from './Camera';
import { ParticleSystem } from './ParticleSystem';
import { SpriteDecals } from './SpriteDecals';
import { BikeConfig, SuspensionConfig, EngineConfig } from '../config/GameConfig';
import { Vec2, rotateVec } from '../physics/MathUtils';
import { SpriteImages, SpriteCalibration } from './SpriteAssets';
import { computeGameplayZones } from '../gameplay/GameplayZones';
import { GhostFrame } from '../gameplay/GhostRecorder';

/**
 * Punto del asiento en espacio local del chasis, en metros desde el centro de
 * masas. Sale del pixel del asiento en bike_body.png (~255,142) traducido con
 * la calibracion de ejes del sprite; lo usan la moto y el fantasma.
 */
const SEAT_LOCAL: Vec2 = { x: -0.25, y: 0.1 };

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

  /** Ancho del lienzo en pixeles de dispositivo (ya incluye devicePixelRatio). */
  get viewportWidthPx(): number {
    return this.canvas.width;
  }

  /** Alto del lienzo en pixeles de dispositivo. */
  get viewportHeightPx(): number {
    return this.canvas.height;
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

  private worldToScreen(camera: CameraPose, wx: number, wy: number, shake: Vec2): { x: number; y: number } {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const ppm = camera.pixelsPerMeter;
    return {
      x: cx + (wx - camera.x + shake.x) * ppm,
      y: cy - (wy - camera.y + shake.y) * ppm,
    };
  }

  /**
   * Dibuja un fotograma.
   *
   * `camera` y `bike` llegan YA INTERPOLADOS (ver RaceManager.getInterpolatedBike
   * y Camera.getPose): el renderer no vuelve a mirar el estado "vivo" de la
   * simulacion en ningun sitio, porque mezclar estado interpolado con estado
   * del ultimo tick es exactamente lo que produce el temblor que se queria
   * quitar. Lo mismo con `shake`, que ahora es una funcion del reloj de
   * simulacion y no un `Math.random()` distinto en cada frame.
   */
  render(opts: {
    camera: CameraPose;
    shake: Vec2;
    track: TrackDefinition;
    bike: BikeState;
    particles: ParticleSystem;
    decals: SpriteDecals;
    flowValue: number;
    isRedline: boolean;
    crashed: boolean;
    ghost: GhostFrame | null;
  }): void {
    const { ctx, canvas } = this;
    const { camera, track, bike, particles, decals, isRedline, crashed, ghost, shake } = opts;
    const terrain = track.terrain;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawSky(camera);
    this.drawBackdrop(camera, terrain, shake);
    this.drawTerrain(camera, terrain, shake);
    this.drawTerrainFeatureSprites(camera, track, shake);
    this.drawTrackProps(camera, track, shake);
    this.drawAtmosphere(camera, track, shake);
    this.drawGameplayFeatures(camera, track, shake);
    this.drawTrackGates(camera, track, shake);
    this.drawParticles(camera, particles, shake);
    this.drawDecals(camera, decals, shake);
    if (ghost) this.drawGhost(camera, ghost, shake);
    this.drawBike(camera, bike, isRedline, crashed, shake);
    this.drawSpeedTrail(camera, bike, shake);
    this.drawForeground(camera, shake);

    ctx.restore();
  }

  private drawTerrainFeatureSprites(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const images: Record<TerrainFeatureKind, HTMLImageElement> = {
      tabletop: SpriteImages.terrainTabletop,
      stepup: SpriteImages.terrainStepup,
      dropoff: SpriteImages.terrainDropoff,
      whoops: SpriteImages.terrainWhoops,
      rockgarden: SpriteImages.terrainRockgarden,
    };
    const baseDepth: Record<TerrainFeatureKind, number> = {
      tabletop: 1.2,
      stepup: 1.3,
      dropoff: 1.4,
      whoops: 0.6,
      rockgarden: 0.9,
    };

    for (const feature of track.terrainFeatures) {
      const halfViewMeters = this.canvas.width / 2 / camera.pixelsPerMeter;
      if (feature.endX < camera.x - halfViewMeters - 2 || feature.startX > camera.x + halfViewMeters + 2) continue;
      const image = images[feature.kind];
      if (!image.complete || image.naturalWidth === 0) continue;
      const widthMeters = feature.endX - feature.startX;
      const sampleCount = Math.max(12, Math.ceil(widthMeters / 0.35));
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (let i = 0; i <= sampleCount; i++) {
        const x = feature.startX + (widthMeters * i) / sampleCount;
        const y = track.terrain.surfaceY(x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const centerX = (feature.startX + feature.endX) / 2;
      const bottomY = minY - baseDepth[feature.kind];
      const bottomScreen = this.worldToScreen(camera, centerX, bottomY, shake);
      this.ctx.drawImage(
        image,
        bottomScreen.x - (widthMeters * camera.pixelsPerMeter) / 2,
        bottomScreen.y - (maxY - minY + baseDepth[feature.kind]) * camera.pixelsPerMeter,
        widthMeters * camera.pixelsPerMeter,
        (maxY - minY + baseDepth[feature.kind]) * camera.pixelsPerMeter,
      );

      this.ctx.save();
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeStyle = PALETTE.soilRim;
      this.ctx.beginPath();
      for (let i = 0; i <= sampleCount; i++) {
        const x = feature.startX + (widthMeters * i) / sampleCount;
        const p = this.worldToScreen(camera, x, track.terrain.surfaceY(x), shake);
        if (i === 0) this.ctx.moveTo(p.x, p.y);
        else this.ctx.lineTo(p.x, p.y);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Estela de velocidad: polvo que se arrastra desde la moto cuando va muy
   * rapido (no depende de FLOW/REDLINE, solo de la velocidad real), para
   * que "ir a tope" se sienta distinto de "ir normal" incluso sin haber
   * llegado a REDLINE. Mismo truco de espejo que la llama de REDLINE: el
   * extremo denso queda junto a la moto y la cola se arrastra hacia atras.
   */
  private drawSpeedTrail(camera: CameraPose, bike: BikeState, shake: Vec2): void {
    const speed = Math.abs(bike.vx);
    const threshold = EngineConfig.topSpeed * 0.6;
    if (speed < threshold) return;
    const t = Math.min(1, (speed - threshold) / (EngineConfig.topSpeed - threshold));

    const trailLocal: Vec2 = { x: -0.5, y: -0.22 };
    const trailScreen = this.localToScreen(camera, bike, shake, trailLocal);
    const facing = bike.vx >= 0 ? 1 : -1;

    for (const [img, widthMeters, alphaScale] of [
      [SpriteImages.speedStreak, 2.6, 0.7] as const,
      [SpriteImages.speedDebris, 2.2, 0.5] as const,
    ]) {
      if (!img.complete || img.naturalWidth === 0) continue;
      const pxPerMeter = img.naturalWidth / widthMeters;
      const scale = camera.pixelsPerMeter / pxPerMeter;
      this.ctx.save();
      this.ctx.globalAlpha = t * alphaScale;
      this.drawRigidSprite(img, trailScreen, facing > 0 ? 0 : Math.PI, { x: 0, y: img.naturalHeight / 2 }, scale, true);
      this.ctx.restore();
    }
  }

  /**
   * Elementos de primer plano (rocas/cactus muy borrosos, ya vienen con
   * motion blur "horneado" en el propio PNG) que pasan MAS rapido que la
   * pista real -parallax > 1, como si estuvieran mas cerca de la camara
   * que el propio terreno- y se anclan al borde inferior de la pantalla en
   * vez de a la altura del suelo. Es pura sensacion de velocidad, no
   * decoracion de la pista en si.
   */
  private drawForeground(camera: CameraPose, shake: Vec2): void {
    const { ctx, canvas } = this;
    const parallax = 1.35;
    const spacing = 60;
    const worldOffsetPx = camera.x * parallax * camera.pixelsPerMeter;
    const halfWidthPx = canvas.width / 2 + 200;
    const startSlot = Math.floor((worldOffsetPx - halfWidthPx) / (spacing * camera.pixelsPerMeter));
    const endSlot = Math.ceil((worldOffsetPx + halfWidthPx) / (spacing * camera.pixelsPerMeter));

    const pieces = [SpriteImages.foregroundA, SpriteImages.foregroundB];
    for (let slot = startSlot; slot <= endSlot; slot++) {
      const seed = slot * 0.077;
      if (hash(seed) < 0.4) continue; // hueco: no siempre hay algo en primer plano
      const img = pieces[Math.floor(hash(seed * 1.7) * pieces.length) % pieces.length];
      if (!img.complete || img.naturalWidth === 0) continue;
      const jitter = (hash(seed * 2.3) - 0.5) * spacing * 0.5;
      const screenX = canvas.width / 2 + slot * spacing * camera.pixelsPerMeter - worldOffsetPx + jitter * camera.pixelsPerMeter;
      const widthMeters = 8 + hash(seed * 3.1) * 3;
      const scale = (widthMeters * camera.pixelsPerMeter) / img.naturalWidth;
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, screenX - w / 2, canvas.height - h * 0.82, w, h);
    }
    void shake;
  }

  /** Dibuja un sprite anclado por su centro-inferior a un punto del suelo. */
  private drawGroundSprite(
    camera: CameraPose,
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
    'TABLETOP',
    'STEP_UP',
    'DROP_OFF',
    'JUMP_SIMPLE',
    'DOUBLE_JUMP',
    'RISK_LINE_JUMP',
    'BIG_TRIPLE',
    'MEGA_JUMP',
  ]);

  private static readonly NO_GATE_SECTORS = new Set(['BUMPS', 'WHOOPS', 'ROCK_GARDEN']);

  /**
   * Arcos y carteles de la pista: salida al principio, un cartel de "JUMP"
   * al entrar en cada tramo de salto (telegrafia lo que viene, no solo
   * decora), un arco de checkpoint en el resto de sectores intermedios, y
   * el arco de meta al final.
   */
  private drawTrackGates(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const { terrain, labels } = track;
    this.drawGroundSprite(camera, terrain, shake, track.startX, 9, SpriteImages.startGate);
    for (const label of labels) {
      if (label.name === 'START' || label.name === 'FINISH' || Renderer.NO_GATE_SECTORS.has(label.name)) continue;
      if (Renderer.JUMP_SECTORS.has(label.name)) {
        this.drawGroundSprite(camera, terrain, shake, label.x - 3, 5.5, SpriteImages.jumpSign);
      } else {
        this.drawGroundSprite(camera, terrain, shake, label.x, 8, SpriteImages.checkpointGate);
      }
    }
    this.drawGroundSprite(camera, terrain, shake, terrain.endX, 11, SpriteImages.finishGate);
  }

  /**
   * Vida de evento: publico, fotografo, comisario con bandera, carpa de
   * boxes y pickup de asistencia. A proposito NO usan el reparto aleatorio
   * de drawTrackProps -son 1-2 apariciones fijas en puntos con sentido
   * narrativo (salida, meta, antes de la zona tecnica, junto al mega
   * salto), no relleno que se repite cada ~26m-. No afectan a la fisica,
   * son solo ambientacion.
   */
  private drawAtmosphere(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const { terrain, labels } = track;
    const labelX = (name: string): number | null => labels.find((l) => l.name === name)?.x ?? null;

    this.drawGroundSprite(camera, terrain, shake, track.startX + 9, 9, SpriteImages.crowd);
    this.drawGroundSprite(camera, terrain, shake, terrain.endX - 7, 9, SpriteImages.crowd);
    this.drawGroundSprite(camera, terrain, shake, Math.max(terrain.startX + 3, track.startX - 9), 8, SpriteImages.paddockTent);

    const megaJumpX = labelX('MEGA_JUMP');
    if (megaJumpX !== null) this.drawGroundSprite(camera, terrain, shake, megaJumpX - 5, 4.2, SpriteImages.photographer);

    const technicalX = labelX('TECHNICAL');
    if (technicalX !== null) this.drawGroundSprite(camera, terrain, shake, technicalX - 4, 4, SpriteImages.marshalFlag);

    const uphillX = labelX('UPHILL');
    if (uphillX !== null) this.drawGroundSprite(camera, terrain, shake, uphillX + 6, 6.5, SpriteImages.pickupTruck);
  }

  /**
   * Piezas de riesgo/recompensa (ver gameplay/GameplayZones.ts): a
   * diferencia de drawTrackProps y drawAtmosphere, estas SI cambian como se
   * juega (boost, hueco real, aro que hay que acertar) y por eso van
   * colocadas por sector con intencion, nunca al azar. bump_gate y alt_ramp
   * decoran un cambio real del heightfield (ver TrackBuilder/CanyonRun); no
   * hace falta que GameplayZones sepa de ellas porque su "mecanica" ya la
   * resuelve la fisica normal de la moto.
   */
  private drawGameplayFeatures(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const { terrain } = track;
    const zones = computeGameplayZones(track);

    if (zones.bumpGate) this.drawGroundSprite(camera, terrain, shake, zones.bumpGate.x, 5.5, SpriteImages.bumpGate);
    if (zones.altRamp) this.drawGroundSprite(camera, terrain, shake, zones.altRamp.x, 7, SpriteImages.altRamp);
    if (zones.speedPad) this.drawGroundSprite(camera, terrain, shake, zones.speedPad.x, 4.5, SpriteImages.speedPad);
    if (zones.riskGap) {
      const midGapX = zones.riskGap.startX + 12.5;
      this.drawGroundSprite(camera, terrain, shake, midGapX, 22, SpriteImages.riskGap);
    }
    if (zones.flowRing) {
      const img = SpriteImages.flowRing;
      if (img.complete && img.naturalWidth > 0) {
        const widthMeters = 4.5;
        const scale = (widthMeters * camera.pixelsPerMeter) / img.naturalWidth;
        const screenPos = this.worldToScreen(camera, zones.flowRing.x, zones.flowRing.y, shake);
        this.drawRigidSprite(img, screenPos, 0, { x: img.naturalWidth / 2, y: img.naturalHeight / 2 }, scale);
      }
    }
  }

  /**
   * Decoracion suelta a lo largo de la pista: bloques de neumaticos, rocas y
   * banderolas, intercalados de forma deterministica (mismo aspecto cada
   * frame). Mas espaciados que los matojos de drawTerrain -son piezas
   * grandes, no relleno-.
   */
  private drawTrackProps(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const { terrain } = track;
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
      { image: SpriteImages.dangerFlags, widthMeters: 2.4 },
      { image: SpriteImages.ropeBarrier, widthMeters: 4.8 },
      { image: SpriteImages.brokenBarrier, widthMeters: 4.8 },
      { image: SpriteImages.rampDeco, widthMeters: 4.5 },
      { image: SpriteImages.logObstacle, widthMeters: 4.2 },
      { image: SpriteImages.tireStack, widthMeters: 3.4 },
      { image: SpriteImages.boulder, widthMeters: 3.6 },
      { image: SpriteImages.rampSmall, widthMeters: 3.8 },
      { image: SpriteImages.tireMound, widthMeters: 4.0 },
      { image: SpriteImages.ropeTireBarrier, widthMeters: 4.4 },
    ];
    for (let slot = firstSlot; slot <= endX; slot += spacing) {
      const r = hash(slot * 0.091);
      if (r < 0.25) continue; // hueco: no todos los tramos llevan decoracion
      const prop = props[Math.floor(hash(slot * 0.133) * props.length) % props.length];
      const x = slot + (hash(slot * 0.211) - 0.5) * spacing * 0.4;
      if (x < terrain.startX + 6 || x > terrain.endX - 6) continue;
      if (track.terrainFeatures.some((feature) => x > feature.startX - 2 && x < feature.endX + 2)) continue;
      this.drawGroundSprite(camera, terrain, shake, x, prop.widthMeters, prop.image);
    }
  }

  private drawDecals(camera: CameraPose, decals: SpriteDecals, shake: Vec2): void {
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

  private drawSky(camera: CameraPose): void {
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

  /**
   * Dos capas de canon reales (bg_far/bg_mid) con parallax, en mosaico para
   * cubrir toda la pista (~500m) con una imagen que en origen no es tan
   * ancha. Como el arte no es literalmente repetible sin costura, cada
   * tesela alterna con la siguiente en espejo (ping-pong): los bordes
   * encajan exactos porque son la misma imagen reflejada, así que no se ve
   * el corte -algo imperceptible a la distancia y velocidad de scroll de
   * fondo, que ademas van con parallax bajo-.
   */
  private drawBackdrop(camera: CameraPose, terrain: Terrain, shake: Vec2): void {
    const { ctx, canvas } = this;
    const layers: Array<{ image: HTMLImageElement; parallax: number; heightFrac: number; baseFrac: number }> = [
      { image: SpriteImages.bgFar, parallax: 0.1, heightFrac: 0.32, baseFrac: 0.66 },
      { image: SpriteImages.bgMid, parallax: 0.22, heightFrac: 0.42, baseFrac: 0.74 },
    ];

    for (const layer of layers) {
      const img = layer.image;
      if (!img.complete || img.naturalWidth === 0) continue;
      const tileH = canvas.height * layer.heightFrac;
      const tileW = (tileH / img.naturalHeight) * img.naturalWidth;
      const baseline = canvas.height * layer.baseFrac;
      const worldOffsetPx = camera.x * layer.parallax * camera.pixelsPerMeter;
      const startTile = Math.floor((worldOffsetPx - canvas.width) / tileW) - 1;
      const endTile = Math.ceil((worldOffsetPx + canvas.width) / tileW) + 1;
      for (let i = startTile; i <= endTile; i++) {
        const screenX = canvas.width / 2 + i * tileW - worldOffsetPx;
        ctx.save();
        if (i % 2 !== 0) {
          // Tesela impar en espejo: mismo borde que la vecina, sin costura.
          ctx.translate(screenX + tileW, baseline - tileH);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, tileW, tileH);
        } else {
          ctx.drawImage(img, screenX, baseline - tileH, tileW, tileH);
        }
        ctx.restore();
      }
    }
    void terrain;
    void shake;
  }

  private drawTerrain(camera: CameraPose, terrain: Terrain, shake: Vec2): void {
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

  private drawParticles(camera: CameraPose, particles: ParticleSystem, shake: Vec2): void {
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
  private localToScreen(camera: CameraPose, bike: BikeState, shake: Vec2, local: Vec2): { x: number; y: number } {
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
    mirrorX = false,
  ): void {
    if (!image.complete || image.naturalWidth === 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(-angle);
    if (mirrorX) ctx.scale(-1, 1);
    ctx.drawImage(image, -pivotPx.x * scale, -pivotPx.y * scale, image.naturalWidth * scale, image.naturalHeight * scale);
    ctx.restore();
  }

  private drawBike(camera: CameraPose, bike: BikeState, isRedline: boolean, crashed: boolean, shake: Vec2): void {
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
    //
    // El angulo de cada rueda es el del chasis MAS su propio giro. Antes solo
    // se usaba `bike.angle`, y por eso las ruedas no se movian: giraban lo
    // que giraba la moto entera, es decir, nada mientras se conduce recto.
    //
    // El signo: en mundo, Y va hacia arriba y los angulos positivos son
    // antihorarios; avanzar hacia +x es rodar en sentido HORARIO, asi que el
    // giro propio (positivo = avanzando) se RESTA del angulo del chasis.
    this.drawRigidSprite(
      SpriteImages.wheelRear,
      this.worldToScreen(camera, rearWheelW.x, rearWheelW.y, shake),
      bike.angle - bike.rear.wheel.spin,
      SpriteCalibration.wheelRear.pivotPx,
      scale,
    );
    this.drawRigidSprite(
      SpriteImages.wheelFront,
      this.worldToScreen(camera, frontWheelW.x, frontWheelW.y, shake),
      bike.angle - bike.front.wheel.spin,
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
      y: rearAxlePx.y - (BikeConfig.anchorDropFromCom + restLengthAvg) * spritePxPerMeter,
    };
    const comScreen = this.worldToScreen(camera, bike.x, bike.y, shake);
    this.drawRigidSprite(SpriteImages.bikeBody, comScreen, bike.angle, comPixel, scale);

    // Llama de REDLINE: sale del escape (mismo pixel de referencia que
    // exhaustLocal, derivado igual que el asiento), apuntando siempre hacia
    // atras del chasis -en espejo, para que el extremo ancho quede pegado
    // al tubo y la punta se aleje-. Solo mientras dura el boost.
    if (isRedline && !crashed) {
      const exhaustLocal: Vec2 = { x: -0.88, y: 0.03 };
      const exhaustScreen = this.localToScreen(camera, bike, shake, exhaustLocal);
      const fx = SpriteImages.redlineFx;
      const fxPxPerMeter = fx.naturalWidth > 0 ? fx.naturalWidth / 1.6 : 0;
      const fxScale = fxPxPerMeter > 0 ? camera.pixelsPerMeter / fxPxPerMeter : 0;
      this.drawRigidSprite(fx, exhaustScreen, bike.angle, { x: 0, y: fx.naturalHeight / 2 }, fxScale, true);
    }

    this.ctx.restore();

    // Piloto: sentado sobre el asiento (punto fijo en espacio local del
    // chasis) mientras conduce; en crash se sustituye por una pose de
    // caida separada de la moto (ver brief: "separar visualmente piloto y
    // moto" en vez de solo recolorear al mismo piloto sentado).
    this.drawRider(camera, bike, shake, crashed, isRedline);
  }

  private drawGhost(camera: CameraPose, ghost: GhostFrame, shake: Vec2): void {
    const { rearAxlePx, frontAxlePx } = SpriteCalibration.bike;
    const spritePxPerMeter = (frontAxlePx.x - rearAxlePx.x) / BikeConfig.wheelBase;
    const scale = camera.pixelsPerMeter / spritePxPerMeter;
    const restLength = (SuspensionConfig.front.restLength + SuspensionConfig.rear.restLength) / 2;
    const axleY = -(BikeConfig.anchorDropFromCom + restLength);
    const axleOffset = BikeConfig.wheelBase / 2;
    const rearOffset = rotateVec({ x: -axleOffset, y: axleY }, ghost.rotation);
    const frontOffset = rotateVec({ x: axleOffset, y: axleY }, ghost.rotation);
    const comPixel = {
      x: (rearAxlePx.x + frontAxlePx.x) / 2,
      y: rearAxlePx.y - (BikeConfig.anchorDropFromCom + restLength) * spritePxPerMeter,
    };

    this.ctx.save();
    this.ctx.globalAlpha = 0.32;
    this.ctx.filter = 'grayscale(1) sepia(1) saturate(7) hue-rotate(135deg) brightness(1.35)';
    // El fantasma solo guarda (t, x, y, rotacion): ampliar su formato para
    // meter el angulo de rueda invalidaria los records ya guardados en
    // localStorage. Como en rodadura pura el giro es exactamente
    // distancia/radio, se deriva de la x y queda sincronizado sin tocar el
    // formato ni romper el ghost de nadie.
    const ghostSpin = ghost.x / BikeConfig.wheelRadius;
    this.drawRigidSprite(SpriteImages.wheelRear, this.worldToScreen(camera, ghost.x + rearOffset.x, ghost.y + rearOffset.y, shake), ghost.rotation - ghostSpin, SpriteCalibration.wheelRear.pivotPx, scale);
    this.drawRigidSprite(SpriteImages.wheelFront, this.worldToScreen(camera, ghost.x + frontOffset.x, ghost.y + frontOffset.y, shake), ghost.rotation - ghostSpin, SpriteCalibration.wheelFront.pivotPx, scale);
    this.drawRigidSprite(SpriteImages.bikeBody, this.worldToScreen(camera, ghost.x, ghost.y, shake), ghost.rotation, comPixel, scale);

    const seatOffset = rotateVec(SEAT_LOCAL, ghost.rotation);
    const riderImg = SpriteImages.rider;
    const riderPxPerMeter = riderImg.naturalHeight / SpriteCalibration.rider.assumedHeightMeters;
    const riderScale = riderPxPerMeter > 0 ? camera.pixelsPerMeter / riderPxPerMeter : 0;
    this.drawRigidSprite(riderImg, this.worldToScreen(camera, ghost.x + seatOffset.x, ghost.y + seatOffset.y, shake), ghost.rotation, SpriteCalibration.rider.hipPivotPx, riderScale);
    this.ctx.restore();
  }

  private drawRider(camera: CameraPose, bike: BikeState, shake: Vec2, crashed: boolean, isRedline: boolean): void {
    if (crashed) {
      // Pose de caida: no rota con el chasis ni se ancla al asiento -es
      // precisamente lo contrario, un cuerpo ya separado de la moto-, solo
      // se coloca junto a donde quedo tirada.
      const crashImg = SpriteImages.riderCrash;
      const crashPxPerMeter = crashImg.naturalHeight > 0 ? crashImg.naturalHeight / 1.1 : 0;
      const crashScale = crashPxPerMeter > 0 ? camera.pixelsPerMeter / crashPxPerMeter : 0;
      const crashScreen = this.worldToScreen(camera, bike.x + 1.9, bike.y + 0.15, shake);
      this.drawRigidSprite(crashImg, crashScreen, -0.6, { x: 190, y: 170 }, crashScale);
      return;
    }

    // Punto del asiento en espacio local del chasis (metros desde el centro de
    // masas), derivado del pixel del asiento en bike_body.png (~255,142) con
    // la misma calibracion eje/escala que usa el chasis (ver drawBike).
    //
    // Ojo al signo de la Y: al corregir la geometria de la moto el centro de
    // masas bajo 0.73 m respecto al dibujo (ver BikeConfig.anchorDropFromCom),
    // asi que el asiento pasa de estar 0.63 m POR DEBAJO del centro de masas a
    // estar 0.10 m POR ENCIMA. Con el valor viejo el piloto quedaba medio
    // metro por debajo de su moto.
    //
    // Sobre ese punto se suma la POSE del piloto (ver RiderPose.ts): un
    // desplazamiento adelante/atras, uno vertical y un angulo de torso
    // propios, todos independientes del chasis. Es la diferencia entre un
    // muneco atornillado al asiento y alguien conduciendo: al frenar se va
    // sobre el manillar, al acelerar se echa atras, al comerse un bache se
    // hunde con la suspension y al despegar se estira.
    const seatLocal: Vec2 = { x: SEAT_LOCAL.x + bike.rider.shiftX, y: SEAT_LOCAL.y + bike.rider.shiftY };
    const seatScreen = this.localToScreen(camera, bike, shake, seatLocal);

    const riderImg = SpriteImages.rider;
    const riderPxPerMeter = riderImg.naturalHeight / SpriteCalibration.rider.assumedHeightMeters;
    const scale = riderPxPerMeter > 0 ? camera.pixelsPerMeter / riderPxPerMeter : 0;

    const filter = isRedline ? 'saturate(1.4) hue-rotate(-8deg)' : 'none';
    this.ctx.save();
    this.ctx.filter = filter;
    this.drawRigidSprite(
      riderImg,
      seatScreen,
      bike.angle + bike.rider.torsoAngle,
      SpriteCalibration.rider.hipPivotPx,
      scale,
    );
    this.ctx.restore();
  }
}
