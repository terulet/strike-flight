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
import { BikeState, wheelAnchorWorld, wheelVisualCenterWorld } from '../physics/Bike';
import { Sprite, filteredSprite, outlinedSprite, scaledSprite, spriteHeight, spriteReady, spriteWidth } from './SpriteFilters';
import { CameraPose } from './Camera';
import { ParticleSystem } from './ParticleSystem';
import { Shockwaves } from './Shockwaves';
import { ScreenEffects } from './ScreenEffects';
import { SpriteDecals } from './SpriteDecals';
import { BikeConfig, SuspensionConfig, EngineConfig, CrashConfig } from '../config/GameConfig';
import { Vec2, rotateVec } from '../physics/MathUtils';
import { SpriteImages, SpriteCalibration } from './SpriteAssets';
import { computeGameplayZones } from '../gameplay/GameplayZones';
import { riderPieceDraws, solveRiderRig } from './RiderRig';
import { TerrainPainter } from './TerrainPainter';
import { GhostFrame } from '../gameplay/GhostRecorder';

/**
 * Punto del asiento en espacio local del chasis, en metros desde el centro de
 * masas. Sale del pixel del asiento en bike_body.png (~255,142) traducido con
 * la calibracion de ejes del sprite; lo usan la moto y el fantasma.
 */
const SEAT_LOCAL: Vec2 = { x: -0.25, y: 0.1 };
/**
 * Boca del escape en espacio local del chasis. Es el mismo pixel de
 * referencia que usaba el sprite de llama; ahora lo consume el emisor de
 * particulas (ver ParticleSystem.spawnExhaustFlame).
 */
export const EXHAUST_LOCAL: Vec2 = { x: -0.88, y: 0.03 };

/** Traduce un punto en espacio local del chasis (x=adelante, y=arriba, origen en el centro de masas) a mundo. */
/**
 * Punto en espacio local del chasis -> coordenadas de mundo. Se exporta
 * porque main.ts necesita la boca del escape para emitir la llamarada, y
 * duplicar la transformacion alli seria abrir la puerta a que las dos
 * versiones se separen.
 */
export function localToWorld(bike: BikeState, local: Vec2): Vec2 {
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

/** Lavado y oscurecido del mobiliario de pista, horneado una sola vez por sprite. */
/** Tono del piloto: algo mas apagado que los plasticos de la moto, para que no compitan. */
const RIDER_TONE = 'brightness(0.88) saturate(1.05)';
/** Margen del horneado del contorno del piloto, en pixeles de sprite. */
const RIDER_OUTLINE_PAD = 5;
const PROP_FILTER = 'saturate(0.82) brightness(0.92)';
/** Paso del reparto de decoracion. Tiene que ser coprimo con el numero de modelos. */
const PROP_STRIDE = 5;
/** Tinte azulado del fantasma, horneado igual que el resto. */
const GHOST_FILTER = 'grayscale(1) sepia(1) saturate(7) hue-rotate(135deg) brightness(1.35)';
const ghostTint = (image: HTMLImageElement): Sprite => filteredSprite(image, GHOST_FILTER);

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrainPainter: TerrainPainter;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');
    this.ctx = ctx;
    this.terrainPainter = new TerrainPainter(ctx);
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
    shockwaves: Shockwaves;
    screenEffects: ScreenEffects;
    flowValue: number;
    isRedline: boolean;
    crashed: boolean;
    /** Segundos desde el choque, para separar al piloto despues del impacto. */
    crashElapsed?: number;
    ghost: GhostFrame | null;
  }): void {
    const { ctx } = this;
    const { camera, track, bike, particles, decals, shockwaves, screenEffects, isRedline, crashed, ghost, shake } = opts;
    const crashElapsed = opts.crashElapsed ?? 0;
    const terrain = track.terrain;

    ctx.save();
    // Sin clearRect: el cielo cubre el lienzo entero en la linea siguiente, y
    // borrar un millon de pixeles para volver a pintarlos cuesta lo mismo que
    // pintarlos.
    this.drawSky(camera);
    this.drawBackdrop(camera, terrain, shake);
    this.drawTerrain(camera, terrain, shake);
    // Los PNG de obstaculo (terrain_tabletop y companyia) ya no se dibujan.
    // Eran imagenes estiradas al rango x de cada pieza, asi que su silueta no
    // tenia por que coincidir -y no coincidia- con la curva contra la que se
    // choca: la moto aterrizaba sobre una cinta de tierra mientras el "suelo"
    // dibujado era una pared de roca medio metro mas abajo. Es exactamente la
    // sensacion de decorado pegado que habia que quitar. El relieve lo pone
    // ahora TerrainPainter, derivado de la propia curva de colision.
    this.drawTrackProps(camera, track, shake);
    this.drawAtmosphere(camera, track, shake);
    this.drawGameplayFeatures(camera, track, shake);
    this.drawTrackGates(camera, track, shake);
    this.drawParticles(camera, particles, shake);
    this.drawDecals(camera, decals, shake);
    if (ghost) this.drawGhost(camera, ghost, shake);
    this.drawWheelContactShadows(camera, terrain, bike, shake);
    // Las ondas van sobre el suelo y por DEBAJO de la moto: son el golpe que
    // acaba de dar la rueda, no un adorno flotando delante.
    shockwaves.draw(ctx, camera, (x, y) => this.worldToScreen(camera, x, y, shake));
    this.drawBike(camera, bike, isRedline, crashed, shake, crashElapsed);
    this.drawSpeedTrail(camera, bike, isRedline, shake);
    this.drawForeground(camera, shake);
    // Lo ultimo: destellos, lineas de velocidad y vinieta van por encima del
    // mundo entero (el HUD es DOM y sigue quedando por encima de esto).
    screenEffects.draw(ctx);

    ctx.restore();
  }

  /**
   * Tierra levantada por el TURBO.
   *
   * Antes esto era otra cosa y estaba mal de tres maneras. Se dibujaba una
   * nube de polvo (`speed_streak`) clavada al chasis en un punto local fijo,
   * con lo que: (1) no se despegaba nunca de la moto -era una mancha pintada
   * encima, no polvo-; (2) giraba con el chasis, asi que en un mortal daba la
   * vuelta con la moto; y (3) salia con solo pasar del 60% de la velocidad
   * punta, o sea casi siempre, tambien EN EL AIRE, donde no hay nada que
   * levantar.
   *
   * Ahora sale solo cuando hay algo que celebrar -REDLINE- y solo con la
   * rueda en el suelo, y va anclada al punto de contacto en coordenadas de
   * MUNDO y sin girar: es material salido de debajo del neumatico, no una
   * calcomania. El polvo continuo de rodadura sigue donde tiene que estar,
   * en el sistema de particulas (ver ParticleSystem.spawnRollingDust), que
   * son particulas de verdad y se quedan atras.
   */
  private drawSpeedTrail(camera: CameraPose, bike: BikeState, isRedline: boolean, shake: Vec2): void {
    if (!isRedline) return;
    if (!bike.rear.inContact) return;
    const speed = Math.abs(bike.vx);
    const threshold = EngineConfig.topSpeed * 0.6;
    if (speed < threshold) return;
    const t = Math.min(1, (speed - threshold) / (EngineConfig.topSpeed - threshold));

    const img = SpriteImages.speedDebris;
    if (!img.complete || img.naturalWidth === 0) return;
    const widthMeters = 2.2;
    const pxPerMeter = img.naturalWidth / widthMeters;
    const scale = camera.pixelsPerMeter / pxPerMeter;
    // Punto de contacto de la trasera, no un punto del chasis: sale del suelo.
    const contact = this.worldToScreen(camera, bike.rear.contactX, bike.rear.groundY + 0.18, shake);
    this.ctx.save();
    this.ctx.globalAlpha = t * 0.5;
    // Angulo 0: no acompana al cabeceo de la moto.
    this.drawRigidSprite(img, contact, 0, { x: 0, y: img.naturalHeight / 2 }, scale, true);
    this.ctx.restore();
  }

  /**
   * Elementos de primer plano (rocas/matojos muy borrosos, ya vienen con
   * motion blur "horneado" en el propio PNG) que pasan MAS rapido que la
   * pista real -parallax > 1, como si estuvieran mas cerca de la camara que
   * el propio terreno- y se anclan al borde inferior de la pantalla.
   *
   * Estan calibrados para el encuadre CERRADO de ahora (la moto ocupa el
   * 14-18% del ancho, ver CameraConfig): con los 8-11 m de ancho que tenian
   * cuando la camara veia 30 m, cada pieza era un borron marron que cruzaba
   * media pantalla por delante de la moto. Ahora asoman solo por el borde
   * inferior -`FOREGROUND_REVEAL` del alto de la pieza- y van a media
   * opacidad: siguen dando velocidad periferica sin ensuciar la lectura.
   */
  private drawForeground(camera: CameraPose, shake: Vec2): void {
    const { ctx, canvas } = this;
    const parallax = 1.35;
    const spacing = 46;
    const worldOffsetPx = camera.x * parallax * camera.pixelsPerMeter;
    const halfWidthPx = canvas.width / 2 + 200;
    const startSlot = Math.floor((worldOffsetPx - halfWidthPx) / (spacing * camera.pixelsPerMeter));
    const endSlot = Math.ceil((worldOffsetPx + halfWidthPx) / (spacing * camera.pixelsPerMeter));

    const pieces = [SpriteImages.foregroundA, SpriteImages.foregroundB];
    ctx.save();
    ctx.globalAlpha = 0.42;
    for (let slot = startSlot; slot <= endSlot; slot++) {
      const seed = slot * 0.077;
      if (hash(seed) < 0.55) continue; // hueco: la mayor parte del rato no hay nada delante
      const img = pieces[Math.floor(hash(seed * 1.7) * pieces.length) % pieces.length];
      if (!img.complete || img.naturalWidth === 0) continue;
      const jitter = (hash(seed * 2.3) - 0.5) * spacing * 0.5;
      const screenX = canvas.width / 2 + slot * spacing * camera.pixelsPerMeter - worldOffsetPx + jitter * camera.pixelsPerMeter;
      const widthMeters = 3.2 + hash(seed * 3.1) * 1.6;
      const scale = (widthMeters * camera.pixelsPerMeter) / img.naturalWidth;
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, screenX - w / 2, canvas.height - h * Renderer.FOREGROUND_REVEAL, w, h);
    }
    ctx.restore();
    void shake;
  }

  /** Fraccion del alto de una pieza de primer plano que asoma por el borde inferior. */
  private static readonly FOREGROUND_REVEAL = 0.3;

  /** Dibuja un sprite anclado por su centro-inferior a un punto del suelo. */
  private drawGroundSprite(
    camera: CameraPose,
    terrain: Terrain,
    shake: Vec2,
    x: number,
    widthMeters: number,
    image: Sprite,
  ): void {
    if (!spriteReady(image)) return;
    const scale = (widthMeters * camera.pixelsPerMeter) / spriteWidth(image);
    const groundY = terrain.surfaceY(x);
    const p = this.worldToScreen(camera, x, groundY, shake);
    const w = spriteWidth(image) * scale;
    const h = spriteHeight(image) * scale;
    this.ctx.drawImage(image, p.x - w / 2, p.y - h, w, h);
  }

  /** Nombres de sector que empiezan con un salto: ahi va el cartel de "JUMP" que telegrafia lo que viene. */
  private static readonly JUMP_SECTORS = new Set([
    'TABLETOP',
    'STEP_UP',
    'DROP_OFF',
    'DESCENT',
    'JUMP_SIMPLE',
    'DOUBLE_JUMP',
    'RISK_LINE_JUMP',
    'BIG_TRIPLE',
    'MEGA_JUMP',
  ]);

  /**
   * Arcos y carteles de la pista: arco de salida, un cartel de "JUMP" antes
   * de cada pieza de salto y el arco de meta EN la linea de meta.
   *
   * Ya no hay arcos de checkpoint intermedios. Eran uno por cada etiqueta de
   * sector, y con el encuadre cerrado de ahora un arco de 8 m ocupa mas que
   * la pantalla entera: la moto desaparecia literalmente detras del cartel
   * cada pocos segundos. Ademas los sectores estan congelados en el corte
   * vertical, asi que anunciar "CHECKPOINT" prometia una mecanica que no
   * existe. Los tres carteles que quedan marcan cosas reales: donde empieza
   * la carrera, donde hay un salto y donde acaba.
   */
  private drawTrackGates(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const { terrain, labels } = track;
    this.drawGroundSprite(camera, terrain, shake, track.startX, 6.5, SpriteImages.startGate);
    for (const label of labels) {
      if (!Renderer.JUMP_SECTORS.has(label.name)) continue;
      this.drawGroundSprite(camera, terrain, shake, label.x - 4.5, 3.2, SpriteImages.jumpSign);
    }
    // La meta va donde para el crono, no al final del terreno: antes se
    // dibujaba en `terrain.endX`, 26 m mas alla, y se cruzaba la linea sin
    // ver nada.
    this.drawGroundSprite(camera, terrain, shake, track.finishX, 7, SpriteImages.finishGate);
  }

  /**
   * Vida de evento: publico en salida y meta y carpa de boxes detras de la
   * parrilla. A proposito NO usan el reparto aleatorio de drawTrackProps
   * -son apariciones fijas en puntos con sentido narrativo-, y van
   * colocadas FUERA del corredor por el que se pasa rodando para no comerse
   * el encuadre. No afectan a la fisica.
   */
  private drawAtmosphere(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const { terrain } = track;
    this.drawGroundSprite(camera, terrain, shake, Math.max(terrain.startX + 3, track.startX - 12), 5.5, SpriteImages.paddockTent);
    this.drawGroundSprite(camera, terrain, shake, track.startX - 5, 6, SpriteImages.crowd);
    this.drawGroundSprite(camera, terrain, shake, track.finishX + 9, 6, SpriteImages.crowd);
  }

  /**
   * Piezas de riesgo/recompensa que SI son objetos: el pad de turbo, que es
   * una plancha apoyada en el suelo, y el aro, que es una estructura de
   * verdad plantada en mitad del hueco.
   *
   * Aqui habia tres cosas mas -un kicker, un bache y un canon- y las tres
   * eran el mismo error que ya se corrigio con los PNG de obstaculo: dibujos
   * que traen su PROPIO terreno pintado (roca, tierra, taludes) y se pegan
   * encima del terreno real. La silueta del dibujo no coincide -ni puede
   * coincidir- con la curva contra la que se choca, asi que se veia una rampa
   * roja preciosa por la que la moto no subia, apoyada en una tierra que no
   * era el suelo. Y ademas no hacian falta: el relieve de verdad ya esta en
   * el heightfield y lo pinta TerrainPainter.
   *
   * El criterio que queda, y que conviene no perder: si la pieza trae suelo
   * dibujado, no va; si es un objeto que se apoya en el suelo, si.
   */
  private drawGameplayFeatures(camera: CameraPose, track: TrackDefinition, shake: Vec2): void {
    const { terrain } = track;
    const zones = computeGameplayZones(track);

    for (const pad of zones.speedPads) {
      this.drawGroundSprite(camera, terrain, shake, pad.x, 4.5, SpriteImages.speedPad);
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
    const visibleStartX = Math.max(terrain.startX, camera.x - halfWidthMeters - 6);
    const visibleEndX = Math.min(terrain.endX, camera.x + halfWidthMeters + 6);
    const spacing = 32;
    // Anchos a escala del encuadre CERRADO: con 12,5 m de vista, una pieza de
    // 4,5 m ocupaba mas de un tercio de la pantalla y competia con la moto.
    // Ahora ninguna pasa de 2,6 m, que es el doble de la moto y se lee como
    // lo que es: mobiliario de pista al borde del trazado.
    //
    // Son ONCE modelos porque once es lo que cabe: contando huecos y las
    // zonas de obstaculo, donde no se pone decoracion, la pista coloca once
    // piezas. Los tres que sobraban -barrera rota, tronco y barrera de
    // cuerda con neumaticos- eran ademas los mas redundantes con los que ya
    // estaban, y se han borrado en vez de dejarlos viajando en la build para
    // no verse nunca.
    const props: Array<{ image: HTMLImageElement; widthMeters: number }> = [
      { image: SpriteImages.barrier, widthMeters: 2.4 },
      { image: SpriteImages.rockClusterA, widthMeters: 2.2 },
      { image: SpriteImages.rockClusterB, widthMeters: 2.2 },
      { image: SpriteImages.bannerFlag, widthMeters: 1.1 },
      { image: SpriteImages.cactusCluster, widthMeters: 1.6 },
      { image: SpriteImages.fenceBanner, widthMeters: 2.6 },
      { image: SpriteImages.dangerFlags, widthMeters: 1.4 },
      { image: SpriteImages.ropeBarrier, widthMeters: 2.5 },
      { image: SpriteImages.tireStack, widthMeters: 1.7 },
      { image: SpriteImages.boulder, widthMeters: 1.8 },
      { image: SpriteImages.tireMound, widthMeters: 2.0 },
    ];
    // Ligeramente lavados y oscurecidos: quedan por detras del plano de la
    // moto sin necesidad de otra capa de parallax. El filtro va horneado en
    // el sprite (ver SpriteFilters.ts), no aplicado en cada dibujo.
    // El recorrido empieza SIEMPRE al principio de la pista, no en el borde
    // izquierdo de la pantalla, y solo se dibuja lo que cae dentro de la
    // vista. Cuesta unas treinta vueltas de bucle por fotograma y a cambio el
    // indice de modelo depende de la PISTA y no de donde este la camara.
    //
    // El modelo se elige por paso coprimo sobre las piezas realmente
    // colocadas. Con el hash de antes, medido sobre una vuelta entera, seis
    // de los catorce modelos no salian NUNCA: 389 KB de arte que se
    // descargaba para no verse jamas. Un paso coprimo con el numero de
    // modelos recorre la lista entera antes de repetir.
    const firstSlot = Math.floor(terrain.startX / spacing) * spacing;
    let placedIndex = 0;
    for (let slot = firstSlot; slot <= terrain.endX; slot += spacing) {
      if (hash(slot * 0.091) < 0.42) continue; // hueco: la mayoria de los tramos van limpios
      const x = slot + (hash(slot * 0.211) - 0.5) * spacing * 0.4;
      if (x < terrain.startX + 6 || x > terrain.endX - 6) continue;
      if (track.terrainFeatures.some((feature) => x > feature.startX - 2 && x < feature.endX + 2)) continue;
      const prop = props[(placedIndex * PROP_STRIDE) % props.length];
      placedIndex += 1;
      if (x < visibleStartX || x > visibleEndX) continue;
      this.drawGroundSprite(camera, terrain, shake, x, prop.widthMeters, filteredSprite(prop.image, PROP_FILTER));
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

  /**
   * Cielo: degradado vertical mas resplandor de sol bajo. Los dos dependen
   * SOLO del tamano del lienzo, asi que se hornean una vez y a partir de ahi
   * el cielo es una copia. Rellenar dos degradados de pantalla completa en
   * cada fotograma costaba, medido, tanto como dibujar el terreno entero.
   */
  private skyCache: { canvas: HTMLCanvasElement; width: number; height: number } | null = null;

  private skyLayer(): HTMLCanvasElement | null {
    const { canvas } = this;
    if (this.skyCache && this.skyCache.width === canvas.width && this.skyCache.height === canvas.height) {
      return this.skyCache.canvas;
    }
    const baked = document.createElement('canvas');
    baked.width = canvas.width;
    baked.height = canvas.height;
    const ctx = baked.getContext('2d');
    if (!ctx) return null;

    const sky = ctx.createLinearGradient(0, 0, 0, baked.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.65, PALETTE.skyHorizon);
    sky.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, baked.width, baked.height);

    // Resplandor de sol bajo, fijo respecto a la camara para dar sensacion de
    // "tarde en el canon" sin que se note que en realidad no hay sol real.
    const glow = ctx.createRadialGradient(
      baked.width * 0.72,
      baked.height * 0.42,
      0,
      baked.width * 0.72,
      baked.height * 0.42,
      baked.width * 0.5,
    );
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, baked.width, baked.height);

    this.skyCache = { canvas: baked, width: canvas.width, height: canvas.height };
    return baked;
  }

  private drawSky(camera: CameraPose): void {
    const baked = this.skyLayer();
    if (baked) this.ctx.drawImage(baked, 0, 0);
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
    /**
     * `filter` es bruma atmosferica, no capricho. El fondo venia igual de
     * saturado y de contrastado que la pista, asi que la moto competia con un
     * canon entero por la atencion y el suelo se confundia con la llanura
     * pintada detras. Restandole saturacion y contraste a lo lejano, la
     * profundidad se lee sola y la moto se separa del fondo, que es un
     * requisito explicito.
     */
    const layers: Array<{
      image: HTMLImageElement;
      parallax: number;
      heightFrac: number;
      baseFrac: number;
      filter: string;
      haze: number;
    }> = [
      {
        image: SpriteImages.bgFar,
        parallax: 0.1,
        heightFrac: 0.32,
        baseFrac: 0.66,
        filter: 'saturate(0.52) brightness(1.06) contrast(0.82)',
        haze: 0.3,
      },
      {
        image: SpriteImages.bgMid,
        parallax: 0.22,
        heightFrac: 0.42,
        baseFrac: 0.74,
        filter: 'saturate(0.72) brightness(0.97) contrast(0.9)',
        haze: 0.16,
      },
    ];

    for (const layer of layers) {
      // Horneado, no en caliente: el filtro (`ctx.filter`) Y el reescalado de
      // estas dos capas -que cubren la pantalla entera, varias teselas cada
      // una, en cada fotograma- eran juntos la mitad del coste del render y
      // hundian el juego a 5 fps. Ver SpriteFilters.ts.
      const source = layer.image;
      if (!source.complete || source.naturalWidth === 0) continue;
      ctx.save();
      const tileH = canvas.height * layer.heightFrac;
      const tileW = (tileH / source.naturalHeight) * source.naturalWidth;
      const img = scaledSprite(source, layer.filter, tileW, tileH);
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
      ctx.restore();

      // Velo calido sobre la capa: es la bruma del valle, y ademas apaga el
      // borde inferior para que no corte en seco contra la capa siguiente.
      // El velo es mas denso justo en el BORDE SUPERIOR de la capa. Ahi la
      // imagen termina en un corte recto contra el cielo, y en una pantalla
      // vertical -donde sobra cielo- ese corte se ve como una linea. Con la
      // bruma cargada arriba, la capa se disuelve en el cielo en vez de
      // terminar de golpe, que ademas es como se ve un canon lejano de
      // verdad.
      const veil = ctx.createLinearGradient(0, baseline - tileH, 0, baseline);
      veil.addColorStop(0, `rgba(238, 190, 140, ${Math.min(1, layer.haze * 2.1)})`);
      veil.addColorStop(0.22, `rgba(238, 190, 140, ${layer.haze * 0.5})`);
      veil.addColorStop(1, `rgba(238, 190, 140, ${layer.haze})`);
      ctx.fillStyle = veil;
      ctx.fillRect(0, baseline - tileH, canvas.width, tileH);
    }
    void terrain;
    void shake;
  }

  /**
   * Suelo. Todo el trabajo esta en TerrainPainter, que lo construye por capas
   * a partir de la misma curva contra la que se choca: estratos, tierra
   * suelta, sombreado por pendiente, oclusion en los valles, roderas, cresta
   * iluminada, piedras y matojos. Por construccion, lo que se ve es donde se
   * choca.
   */
  private drawTerrain(camera: CameraPose, terrain: Terrain, shake: Vec2): void {
    this.terrainPainter.paint(
      camera,
      terrain,
      this.canvas.width,
      this.canvas.height,
      (x, y) => this.worldToScreen(camera, x, y, shake),
    );
  }

  /**
   * Particulas. Cada tipo se pinta distinto para que se distingan de un
   * vistazo: los terrones son opacos y con borde, el polvo es un halo suave
   * que se expande, la frenada va mas gris y baja, y el impacto arranca casi
   * blanco. Sin esa diferencia todo acaba siendo la misma nube beige.
   */
  private drawParticles(camera: CameraPose, particles: ParticleSystem, shake: Vec2): void {
    const { ctx } = this;
    ctx.save();
    particles.forEachAlive((x, y, alpha, size, kind) => {
      const p = this.worldToScreen(camera, x, y, shake);
      const radius = Math.max(0.6, size * camera.pixelsPerMeter);

      if (kind === 'dirt') {
        // Terron: opaco, con una cara iluminada arriba.
        ctx.globalAlpha = Math.min(1, alpha * 1.15);
        ctx.fillStyle = '#5a3c25';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, radius, radius * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(214, 170, 120, 0.7)';
        ctx.beginPath();
        ctx.ellipse(p.x - radius * 0.22, p.y - radius * 0.26, radius * 0.5, radius * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (kind === 'flame') {
        // Fuego: se dibuja SUMANDO luz (`lighter`), no tapando. Es lo que hace
        // que donde se solapan dos particulas salga el nucleo blanco y en los
        // bordes quede rojo oscuro, que es como se ve una llama de verdad; con
        // el pintado normal saldrian discos naranjas superpuestos.
        //
        // El color va con la edad de la particula, no con su posicion: recien
        // salida es blanca, luego amarilla, luego naranja y se apaga en rojo.
        const heat = alpha;
        const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        const red = 255;
        const green = Math.round(90 + 165 * heat);
        const blue = Math.round(20 + 180 * Math.pow(heat, 2.4));
        core.addColorStop(0, `rgba(255, ${Math.min(255, green + 40)}, ${Math.min(255, blue + 60)}, ${0.95 * heat})`);
        core.addColorStop(0.45, `rgba(${red}, ${green}, ${blue}, ${0.55 * heat})`);
        core.addColorStop(1, 'rgba(180, 30, 0, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      if (kind === 'impact') {
        gradient.addColorStop(0, `rgba(255, 238, 210, ${alpha * 0.9})`);
        gradient.addColorStop(0.55, `rgba(222, 188, 146, ${alpha * 0.5})`);
      } else if (kind === 'brake') {
        gradient.addColorStop(0, `rgba(198, 178, 156, ${alpha * 0.62})`);
        gradient.addColorStop(0.55, `rgba(160, 140, 120, ${alpha * 0.3})`);
      } else {
        gradient.addColorStop(0, `rgba(228, 199, 160, ${alpha * 0.72})`);
        gradient.addColorStop(0.55, `rgba(196, 163, 124, ${alpha * 0.34})`);
      }
      gradient.addColorStop(1, 'rgba(196, 163, 124, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  private drawRigidSprite(
    image: Sprite,
    screenPos: { x: number; y: number },
    angle: number,
    pivotPx: { x: number; y: number },
    scale: number,
    mirrorX = false,
  ): void {
    if (!spriteReady(image)) return;
    const { ctx } = this;
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(-angle);
    if (mirrorX) ctx.scale(-1, 1);
    ctx.drawImage(image, -pivotPx.x * scale, -pivotPx.y * scale, spriteWidth(image) * scale, spriteHeight(image) * scale);
    ctx.restore();
  }


  /**
   * Sombra de contacto de cada rueda: una elipse en el SUELO, no bajo el
   * sprite. Se estrecha y se oscurece cuando la rueda esta cerca y se abre y
   * se difumina cuando esta en el aire, que es lo que hace que un salto se lea
   * como un salto y no como la moto flotando.
   */
  private drawWheelContactShadows(camera: CameraPose, terrain: Terrain, bike: BikeState, shake: Vec2): void {
    const { ctx } = this;
    ctx.save();
    for (const side of ['rear', 'front'] as const) {
      const centre = wheelVisualCenterWorld(bike, side);
      const groundY = terrain.surfaceY(centre.x);
      const height = Math.max(0, centre.y - BikeConfig.wheelRadius - groundY);
      // Mas de dos metros de altura: la sombra ya no aporta nada.
      if (height > 2.2) continue;
      const t = Math.min(1, height / 2.2);
      const radius = BikeConfig.wheelRadius * (0.95 + t * 1.5);
      const alpha = (1 - t) * 0.42;
      const p = this.worldToScreen(camera, centre.x, groundY + 0.015, shake);
      const rx = radius * camera.pixelsPerMeter;
      const ry = rx * 0.26;
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rx);
      gradient.addColorStop(0, `rgba(28, 16, 8, ${alpha})`);
      gradient.addColorStop(1, 'rgba(28, 16, 8, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Dibuja SOLO la moto, sin mundo. La usa el banco de comprobacion de
   * ensamblaje (`rig-check.html`), que necesita poner la moto en poses
   * construidas a mano -parada, cabeceando, en vuelo, tocando fondo, de
   * caballito, caida- para verificar que ruedas, chasis y piloto siguen
   * montados en su sitio en todas ellas.
   */
  drawBikeOnly(
    camera: CameraPose,
    bike: BikeState,
    opts: { crashed?: boolean; isRedline?: boolean; crashElapsed?: number } = {},
  ): void {
    this.drawBike(camera, bike, opts.isRedline ?? false, opts.crashed ?? false, { x: 0, y: 0 }, opts.crashElapsed ?? 0);
  }

  private drawBike(
    camera: CameraPose,
    bike: BikeState,
    isRedline: boolean,
    crashed: boolean,
    shake: Vec2,
    crashElapsed = 0,
  ): void {
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
    const tinted = (image: HTMLImageElement): Sprite => filteredSprite(image, filter);
    this.ctx.save();

    // Ruedas primero (el chasis las tapa parcialmente por arriba: el
    // guardabarros y la horquilla viven en bike_body.png y pasan por delante
    // del neumatico).
    //
    // El angulo de cada rueda es el del chasis MAS su propio giro. Antes solo
    // se usaba `bike.angle`, y por eso las ruedas no se movian: giraban lo
    // que giraba la moto entera, es decir, nada mientras se conduce recto.
    //
    // El signo: en mundo, Y va hacia arriba y los angulos positivos son
    // antihorarios; avanzar hacia +x es rodar en sentido HORARIO, asi que el
    // giro propio (positivo = avanzando) se RESTA del angulo del chasis.
    //
    // Escala: la MISMA que el chasis. Las tres piezas salen de la misma foto,
    // asi que compartir escala es lo unico que garantiza que cada rueda quede
    // metida dentro de su horquilla y de su basculante. El radio fisico
    // (BikeConfig.wheelRadius) esta derivado precisamente de esta escala, de
    // modo que lo que colisiona y lo que se ve miden lo mismo.
    const rearWheelScale = scale;
    const frontWheelScale = scale;

    // Barra de horquilla y basculante, DEBAJO de las ruedas y del chasis. El
    // PNG del chasis trae su horquilla pintada en la posicion de reposo, asi
    // que en reposo estas barras quedan tapadas por el neumatico y por el
    // propio chasis y no se ven. En cuanto la suspension se extiende -en
    // vuelo, sobre todo- la rueda se aleja del anclaje y sin ellas aparecia
    // un hueco entre el pie de horquilla y el neumatico: la moto se veia
    // desmontada justo en el momento mas visible del juego. Van del anclaje
    // real al eje real, asi que por construccion no puede haber hueco en
    // ningun estado.
    this.drawSuspensionLinks(camera, bike, shake);

    this.drawRigidSprite(
      tinted(SpriteImages.wheelRear),
      this.worldToScreen(camera, rearWheelW.x, rearWheelW.y, shake),
      bike.angle - bike.rear.wheel.spin,
      SpriteCalibration.wheelRear.pivotPx,
      rearWheelScale,
    );
    this.drawRigidSprite(
      tinted(SpriteImages.wheelFront),
      this.worldToScreen(camera, frontWheelW.x, frontWheelW.y, shake),
      bike.angle - bike.front.wheel.spin,
      SpriteCalibration.wheelFront.pivotPx,
      frontWheelScale,
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
    this.drawRigidSprite(tinted(SpriteImages.bikeBody), comScreen, bike.angle, comPixel, scale);

    // La llamarada de REDLINE ya no es un sprite pegado al escape. Era un PNG
    // con forma fija que giraba con el chasis y viajaba con la moto: no
    // parecia fuego, parecia una pegatina de fuego. Ahora son particulas que
    // nacen en la boca del escape y se quedan atras en el mundo (ver
    // ParticleSystem.spawnExhaustFlame, emitidas desde main.ts, que es quien
    // tiene el sistema de particulas).

    this.ctx.restore();

    // Piloto: sentado sobre el asiento (punto fijo en espacio local del
    // chasis) mientras conduce; en crash se sustituye por una pose de
    // caida separada de la moto (ver brief: "separar visualmente piloto y
    // moto" en vez de solo recolorear al mismo piloto sentado).
    this.drawRider(camera, bike, shake, crashed, isRedline, crashElapsed);
  }

  /**
   * Une cada eje con su anclaje en el chasis: horquilla delante, basculante
   * detras. La longitud es exactamente `restLength - compression`, la misma
   * que usa la fisica para colocar la rueda (ver Bike.wheelVisualCenterWorld).
   */
  private drawSuspensionLinks(camera: CameraPose, bike: BikeState, shake: Vec2): void {
    const { ctx } = this;
    const ppm = camera.pixelsPerMeter;
    const links = [
      { side: 'rear' as const, width: 0.1, core: 0.05, coreColor: '#3b3630' },
      { side: 'front' as const, width: 0.085, core: 0.042, coreColor: '#8d7038' },
    ];
    ctx.save();
    ctx.lineCap = 'round';
    for (const link of links) {
      const anchor = wheelAnchorWorld(bike, link.side);
      const axle = wheelVisualCenterWorld(bike, link.side);
      const a = this.worldToScreen(camera, anchor.x, anchor.y, shake);
      const b = this.worldToScreen(camera, axle.x, axle.y, shake);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = '#171310';
      ctx.lineWidth = link.width * ppm;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = link.coreColor;
      ctx.lineWidth = link.core * ppm;
      ctx.stroke();
    }
    ctx.restore();
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
    // El fantasma solo guarda (t, x, y, rotacion): ampliar su formato para
    // meter el angulo de rueda invalidaria los records ya guardados en
    // localStorage. Como en rodadura pura el giro es exactamente
    // distancia/radio, se deriva de la x y queda sincronizado sin tocar el
    // formato ni romper el ghost de nadie.
    const ghostSpin = ghost.x / BikeConfig.wheelRadius;
    this.drawRigidSprite(ghostTint(SpriteImages.wheelRear), this.worldToScreen(camera, ghost.x + rearOffset.x, ghost.y + rearOffset.y, shake), ghost.rotation - ghostSpin, SpriteCalibration.wheelRear.pivotPx, scale);
    this.drawRigidSprite(ghostTint(SpriteImages.wheelFront), this.worldToScreen(camera, ghost.x + frontOffset.x, ghost.y + frontOffset.y, shake), ghost.rotation - ghostSpin, SpriteCalibration.wheelFront.pivotPx, scale);
    this.drawRigidSprite(ghostTint(SpriteImages.bikeBody), this.worldToScreen(camera, ghost.x, ghost.y, shake), ghost.rotation, comPixel, scale);

    // El piloto del fantasma es el TORSO del rig, no el sprite de cuerpo
    // entero. Ese sprite (`rider.webp`) era el ultimo sitio del juego donde
    // se usaba, y solo aparecia aqui: 44 KB que se descargaban para dibujar
    // un piloto con otro aspecto que el de la moto real. El fantasma es una
    // silueta translucida, asi que el torso solo se lee igual de bien.
    const seatOffset = rotateVec(SEAT_LOCAL, ghost.rotation);
    const torso = SpriteImages.riderTorso;
    const torsoPxPerMeter = torso.naturalHeight / SpriteCalibration.rider.assumedHeightMeters;
    const torsoScale = torsoPxPerMeter > 0 ? camera.pixelsPerMeter / torsoPxPerMeter : 0;
    this.drawRigidSprite(
      ghostTint(torso),
      this.worldToScreen(camera, ghost.x + seatOffset.x, ghost.y + seatOffset.y, shake),
      ghost.rotation,
      SpriteCalibration.riderRig.torso.pivotPx,
      torsoScale,
    );
    this.ctx.restore();
  }

  private drawRider(
    camera: CameraPose,
    bike: BikeState,
    shake: Vec2,
    crashed: boolean,
    isRedline: boolean,
    crashElapsed = 0,
  ): void {
    // La separacion llega DESPUES del impacto, no con el. Durante el primer
    // cuarto de segundo el piloto sigue montado -se ve el golpe- y solo luego
    // sale despedido, alejandose y girando.
    const detached = crashed && crashElapsed >= CrashConfig.riderDetachDelay;
    if (detached) {
      const since = crashElapsed - CrashConfig.riderDetachDelay;
      // Pose de caida: no rota con el chasis ni se ancla al asiento -es
      // precisamente lo contrario, un cuerpo ya separado de la moto-, solo
      // se coloca junto a donde quedo tirada.
      const crashImg = SpriteImages.riderCrash;
      const crashPxPerMeter = crashImg.naturalHeight > 0 ? crashImg.naturalHeight / 1.7 : 0;
      const crashScale = crashPxPerMeter > 0 ? camera.pixelsPerMeter / crashPxPerMeter : 0;
      // Sale rodando hacia adelante y frena: parabola corta, no teletransporte.
      const travel = Math.min(1.6, since * 3.4);
      const drop = Math.min(0.35, since * 0.9);
      const tumble = -0.35 - Math.min(1.5, since * 2.2);
      const crashScreen = this.worldToScreen(camera, bike.x + 0.35 + travel, bike.y - 0.1 - drop, shake);
      this.drawRigidSprite(crashImg, crashScreen, tumble, { x: 178, y: 210 }, crashScale);
      return;
    }

    // Piloto articulado: torso, brazo de dos huesos y pierna de dos huesos.
    // Las manos van al manillar y los pies a la estribera por cinematica
    // inversa (ver RiderRig.ts), asi que el cuerpo puede moverse todo lo que
    // pida la pose sin despegarse nunca de la moto.
    const geometry = solveRiderRig({ x: bike.x, y: bike.y }, bike.angle, bike.rider, camera.pixelsPerMeter);

    // Cada pieza va con CONTORNO. El mono del piloto y el carenado de la moto
    // salen del mismo arte -mismo estampado, mismo dorsal-, asi que
    // superpuestos no habia forma de separarlos: el cuerpo se disolvia en la
    // moto. El borde oscuro es lo que devuelve la silueta, y ademas el piloto
    // va un punto mas apagado que los plasticos blancos de la moto, que es
    // como se ve en una foto de carreras de verdad.
    const baseFilter = isRedline ? 'saturate(1.4) hue-rotate(-8deg)' : RIDER_TONE;
    for (const piece of riderPieceDraws(geometry)) {
      const filter = [baseFilter, piece.filter ?? ''].filter(Boolean).join(' ');
      const outlined = outlinedSprite(piece.image, filter, RIDER_OUTLINE_PAD);
      const screen = this.worldToScreen(camera, piece.world.x, piece.world.y, shake);
      if (!outlined) {
        this.drawRigidSprite(filteredSprite(piece.image, filter), screen, piece.angle, piece.pivotPx, geometry.scale);
        continue;
      }
      // El margen del horneado desplaza la imagen dentro del lienzo, asi que
      // el pivote se corre lo mismo o la pieza sale movida.
      this.drawRigidSprite(
        outlined.source,
        screen,
        piece.angle,
        { x: piece.pivotPx.x + outlined.pad, y: piece.pivotPx.y + outlined.pad },
        geometry.scale,
      );
    }
  }
}
