/**
 * Escena de una carrera: junta fondo, mundo, motos, pilotos, particulas,
 * clima, barro en la lente y camara, e interpreta los eventos de la carrera
 * en efectos.
 */
import { clamp, lerp, lerpAngle } from '../core/math';
import { GhostPlayer } from '../game/ghost';
import { RiderProfile } from '../game/progress';
import { Race, TrickEvent } from '../game/race';
import { Rival } from '../game/rival';
import { BIKE, BikeState, WheelState } from '../physics/bike';
import { Backdrop } from './backdrop';
import {
  BikeDrawState,
  LIVERY,
  RiderRig,
  RiderStyle,
  bikeDrawState,
  drawBike,
  drawRiderPose,
  exhaustTipWorld,
  flailPose,
  makeLivery,
  setStyle,
} from './bikeArt';
import { mix } from './color';
import { laneFog, laneOffset, laneScale } from './lanes';
import { Lens } from './lens';
import { Particles, WeatherFx } from './particles';
import { Camera, View, screenTransform, toScreen, worldTransform } from './view';
import { WorldArt } from './world';

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  w: number;
}

interface Ragdoll {
  bike: Body;
  rider: Body;
  draw: BikeDrawState;
  t: number;
}

/** Un fantasma en pista: una vuelta grabada que se reproduce. */
interface GhostFx {
  player: GhostPlayer;
  label: string;
  lane: number;
  rig: RiderRig;
  style: RiderStyle;
  bike: BikeState | null;
  prev: BikeState | null;
}

function ghostWheel(x: number, vx: number, inContact: boolean): WheelState {
  return { comp: 0.09, compVel: 0, spin: x / BIKE.wheelRadius, spinRate: vx / BIKE.wheelRadius, inContact, load: 0, slip: 0, contactX: x, contactY: 0, mud: 0 };
}

/** Todo lo que la escena guarda de cada piloto (jugador o rival). */
interface RiderFx {
  rival: Rival | null;
  lane: number;
  rig: RiderRig;
  style: RiderStyle;
  ragdoll: Ragdoll | null;
}

function lerpBike(a: BikeState, b: BikeState, t: number): BikeState {
  if (Math.abs(a.x - b.x) > 4 || Math.abs(a.y - b.y) > 4) return b;
  return {
    ...b,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    angle: lerpAngle(a.angle, b.angle, t),
    rear: { ...b.rear, comp: lerp(a.rear.comp, b.rear.comp, t), spin: lerp(a.rear.spin, b.rear.spin, t) },
    front: { ...b.front, comp: lerp(a.front.comp, b.front.comp, t), spin: lerp(a.front.spin, b.front.spin, t) },
  };
}

/** Lo que la escena lee de una carrera (una repeticion tambien lo cumple). */
export type SceneRace = Pick<Race, 'mission' | 'track' | 'bike' | 'prevBike' | 'state' | 'time' | 'rivals' | 'lastCheckpoint' | 'collected' | 'stormX' | 'crashBike'>;

function hazeHex(haze: string): string {
  return '#' + haze.split(',').map((n) => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
}

export class Scene {
  readonly camera = new Camera();
  readonly particles = new Particles();
  readonly lens: Lens;
  /** 0..1: cuanto de "plano de cine" hay (camara lenta del gran salto). */
  cinema = 0;
  /** En la demo y en ?autoplay el propio juego arranca los tear-offs. */
  autoTearOff = false;
  private readonly backdrop: Backdrop;
  private readonly world: WorldArt;
  private readonly weather: WeatherFx;
  private readonly riders: RiderFx[];
  private readonly player: RiderFx;
  private ghosts: GhostFx[] = [];
  private readonly haze: string;
  private time = 0;
  private flash = 0;

  /** Sin barro en la lente ni etiquetas (clips). */
  clean = false;

  constructor(
    readonly race: SceneRace,
    rider?: RiderProfile,
  ) {
    const m = race.mission;
    this.backdrop = new Backdrop(m.theme, m.track.terrain.heightAt(m.track.startX), m.track.startX, m.track.finishX);
    this.world = new WorldArt(m);
    this.weather = new WeatherFx(m.theme.weather);
    const mudColor = mix(m.theme.ground.crustShade, '#2a1a0e', 0.35);
    this.lens = new Lens(mix(m.theme.ground.crust, '#4a3220', 0.55));
    const haze = hazeHex(m.theme.haze);
    this.haze = haze;
    this.player = {
      rival: null,
      lane: 0,
      rig: new RiderRig(),
      style: { livery: rider ? makeLivery(rider.colors, rider.number) : LIVERY, fog: 0, fogColor: haze, mud: 0, mudColor, seed: 77 },
      ragdoll: null,
    };
    this.riders = [
      ...race.rivals.map((r, i) => ({
        rival: r,
        lane: r.spec.lane,
        rig: new RiderRig(),
        style: {
          livery: makeLivery(r.spec.colors, r.spec.number, laneFog(r.spec.lane), haze),
          fog: laneFog(r.spec.lane),
          fogColor: haze,
          mud: 0,
          mudColor,
          seed: 11 + i * 13,
        },
        ragdoll: null,
      })),
      this.player,
    ].sort((a, b) => b.lane - a.lane);
    this.camera.reset(this.cameraTarget(race.bike));
  }

  /** Fantasmas en pista (van por los carriles del fondo, semitransparentes). */
  setGhosts(list: Array<{ player: GhostPlayer; label: string }>): void {
    this.ghosts = list.slice(0, 3).map((g, i) => {
      const lane = i + 1;
      const d = g.player.data;
      return {
        player: g.player,
        label: g.label,
        lane,
        rig: new RiderRig(),
        style: { livery: makeLivery(d.colors, d.number, laneFog(lane), this.haze), fog: laneFog(lane), fogColor: this.haze, mud: 0, mudColor: this.player.style.mudColor, seed: 200 + i },
        bike: null,
        prev: null,
      };
    });
  }

  private ghostBike(g: GhostFx, t: number): BikeState {
    const a = g.player.at(t);
    const b = g.player.at(t + 0.05);
    const vx = (b.x - a.x) / 0.05;
    const vy = (b.y - a.y) / 0.05;
    const ground = this.race.track.terrain.heightAt(a.x);
    const onGround = a.y - ground < 0.85;
    return {
      x: a.x,
      y: a.y,
      vx,
      vy,
      angle: a.angle,
      omega: (b.angle - a.angle) / 0.05,
      rear: ghostWheel(a.x, vx, onGround),
      front: ghostWheel(a.x + 0.3, vx, onGround),
      throttle: 1,
      brake: 0,
      lean: 0,
      nitro: false,
      accel: 0,
    };
  }

  /** Diferencia con el primer fantasma (s; negativo = vas por delante). */
  ghostDelta(): { label: string; delta: number } | null {
    const g = this.ghosts[0];
    if (!g || this.race.state !== 'racing') return null;
    const tg = g.player.timeAtX(this.race.bike.x);
    if (tg === null) return null;
    return { label: g.player.data.name, delta: this.race.time - tg };
  }

  /** Barro acumulado por el jugador (0..1). */
  get mudLevel(): number {
    return this.player.style.mud;
  }

  private fxFor(r: Rival): RiderFx | undefined {
    return this.riders.find((x) => x.rival === r);
  }

  // ------------------------------------------------------------- eventos
  onLand(e: TrickEvent): void {
    const b = this.race.bike;
    const rough = e.quality === 'ROUGH';
    this.player.rig.land(e.airTime, rough);
    this.camera.shake(clamp(e.airTime * 0.18 + (rough ? 0.25 : 0), 0, 0.6));
    const n = Math.round(10 + e.airTime * 14);
    const g = this.race.mission.theme.ground;
    const inMud = Math.max(b.rear.mud, b.front.mud);
    for (const w of [b.rear, b.front]) {
      for (let i = 0; i < n / 2; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.particles.emit('dust', w.contactX, w.contactY + 0.1, dir * (1 + Math.random() * 4) + b.vx * 0.2, Math.random() * 1.5, 0.8 + Math.random() * 0.8, 0.25 + Math.random() * 0.35, g.dust);
      }
      for (let i = 0; i < n / (inMud > 0 ? 1.5 : 3); i++) {
        this.particles.emit('clod', w.contactX, w.contactY + 0.05, (Math.random() - 0.3) * 5 + b.vx * 0.3, 2 + Math.random() * (inMud ? 6 : 4), 1.2, 0.03 + Math.random() * 0.05, inMud ? this.player.style.mudColor : g.pebble);
      }
    }
    if (inMud > 0.3) {
      // Aterrizar en un charco: barro hasta las cejas.
      this.player.style.mud = Math.min(1, this.player.style.mud + 0.12);
      this.lens.hit(3 + Math.floor(e.airTime * 2), 0.45);
    }
    if (e.quality === 'PERFECT' && e.airTime > 0.45) this.flash = 0.25;
  }

  private makeRagdoll(b: BikeState, pose: ReturnType<RiderRig['pose']>, strong: boolean): Ragdoll {
    const c = Math.cos(b.angle);
    const s = Math.sin(b.angle);
    return {
      bike: { x: b.x, y: b.y, vx: b.vx * 0.6, vy: Math.max(b.vy, 0) * 0.5 + 2, a: b.angle, w: b.omega * 0.6 + (Math.random() - 0.5) * 6 },
      rider: {
        x: b.x + pose.hip.x * c - pose.hip.y * s,
        y: b.y + pose.hip.x * s + pose.hip.y * c,
        vx: b.vx * 0.85 + 1,
        vy: Math.max(b.vy, 0) * 0.6 + (strong ? 4 : 3),
        a: b.angle,
        w: -4 - Math.random() * 5,
      },
      draw: bikeDrawState(b),
      t: 0,
    };
  }

  onCrash(): void {
    const b = this.race.crashBike ?? this.race.bike;
    this.player.ragdoll = this.makeRagdoll(b, this.player.rig.pose(), true);
    this.camera.shake(0.7);
    const dust = this.race.mission.theme.ground.dust;
    for (let i = 0; i < 26; i++) {
      this.particles.emit('dust', b.x, b.y - 0.3, (Math.random() - 0.5) * 6 + b.vx * 0.3, Math.random() * 2, 1 + Math.random(), 0.3 + Math.random() * 0.4, dust);
      this.particles.emit('spark', b.x, b.y, (Math.random() - 0.3) * 8, Math.random() * 5, 0.4, 0.035, '#ffcf6a');
    }
  }

  onRespawn(): void {
    this.player.ragdoll = null;
    this.player.rig.reset();
    this.flash = 0.35;
  }

  onRivalCrash(r: Rival): void {
    const fx = this.fxFor(r);
    if (!fx) return;
    fx.ragdoll = this.makeRagdoll(r.crashBike ?? r.bike, fx.rig.pose(), false);
    const off = laneOffset(fx.lane);
    for (let i = 0; i < 14; i++) {
      this.particles.emit('dust', r.bike.x, r.bike.y - 0.3 + off, (Math.random() - 0.5) * 5, Math.random() * 2, 1, 0.3 + Math.random() * 0.3, this.race.mission.theme.ground.dust);
    }
  }

  onRivalRespawn(r: Rival): void {
    const fx = this.fxFor(r);
    if (!fx) return;
    fx.ragdoll = null;
    fx.rig.reset();
  }

  // ------------------------------------------------------------ simulacion
  private cameraTarget(b: BikeState): { x: number; y: number; vx: number; vy: number; height: number } {
    return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, height: b.y - this.race.track.terrain.heightAt(b.x) - 0.72 };
  }

  private stepRagdoll(r: Ragdoll, dt: number, lane: number): void {
    const terrain = this.race.track.terrain;
    r.t += dt;
    for (const [body, rad] of [[r.bike, 0.55], [r.rider, 0.3]] as Array<[Body, number]>) {
      body.vy -= BIKE.gravity * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.a += body.w * dt;
      const g = terrain.heightAt(body.x) + rad;
      if (body.y < g) {
        body.y = g;
        if (body.vy < -2) this.particles.emit('dust', body.x, g - rad + laneOffset(lane), 0, 0.5, 0.9, 0.4, this.race.mission.theme.ground.dust);
        body.vy = Math.abs(body.vy) * 0.3;
        body.vx *= 0.8;
        body.w *= 0.75;
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt);
    const race = this.race;
    const b = race.bike;

    for (const fx of this.riders) {
      const bike = fx.rival ? fx.rival.bike : b;
      if (fx.ragdoll) {
        this.stepRagdoll(fx.ragdoll, dt, fx.lane);
        continue;
      }
      if (fx.rival && fx.rival.state === 'out') continue;
      fx.rig.update(dt, bike);
      const moving = fx.rival ? fx.rival.state === 'racing' || fx.rival.state === 'finished' : race.state === 'racing' || race.state === 'finished';
      if (moving) this.emitFromBike(dt, bike, fx);
    }

    for (const g of this.ghosts) {
      g.prev = g.bike;
      g.bike = this.ghostBike(g, race.state === 'countdown' ? 0 : race.time);
      g.rig.update(dt, g.bike);
    }

    const p = this.player;
    if (p.ragdoll) {
      const r = p.ragdoll.rider;
      this.camera.update(dt, { x: r.x, y: r.y, vx: r.vx * 0.3, vy: 0, height: 0 });
    } else {
      this.camera.update(dt, this.cameraTarget(b));
      if (race.state === 'racing') this.lensFromRivals(dt);
    }
    this.camera.cinema = this.cinema;
    this.lens.update(dt);
    if (this.autoTearOff && this.lens.coverage > 0.35) this.lens.tearOff();
    this.particles.update(dt, race.track.terrain);
  }

  /** La rueda del rival que llevas delante te escupe tierra a la cara. */
  private lensFromRivals(dt: number): void {
    const b = this.race.bike;
    for (const fx of this.riders) {
      const r = fx.rival;
      if (!r || r.state !== 'racing' || fx.ragdoll) continue;
      const dx = r.bike.x - b.x;
      if (dx < 0.8 || dx > 10 || !r.bike.rear.inContact || r.bike.throttle < 0.5) continue;
      const speed = Math.hypot(r.bike.vx, r.bike.vy);
      if (speed < 5) continue;
      const rate = 2.2 * (1 - dx / 10) * (r.bike.rear.mud > 0 ? 2.5 : 1);
      if (Math.random() < rate * dt) {
        this.lens.hit(1, 0.6);
        this.player.style.mud = Math.min(1, this.player.style.mud + 0.01);
      }
    }
  }

  private emitFromBike(dt: number, b: BikeState, fx: RiderFx): void {
    const g = this.race.mission.theme.ground;
    const off = laneOffset(fx.lane);
    const speed = Math.hypot(b.vx, b.vy);
    const isPlayer = fx === this.player;
    const rw = b.rear;
    const fw = b.front;
    // El barro se va acumulando.
    const wheelMud = Math.max(rw.inContact ? rw.mud : 0, fw.inContact ? fw.mud : 0);
    fx.style.mud = Math.min(1, fx.style.mud + dt * (wheelMud * speed * 0.035 + speed * 0.0006));
    if (isPlayer && wheelMud > 0.3 && speed > 7 && Math.random() < dt * speed * 0.22) this.lens.hit(1, 0.35);

    if (rw.inContact) {
      const n = this.race.track.terrain.normalAt(rw.contactX);
      const tx = n.y;
      const ty = -n.x;
      const roost = b.throttle * (0.4 + Math.min(1, Math.abs(rw.slip) * 0.5)) + rw.mud * Math.min(1, speed / 10);
      const count = Math.floor(roost * (isPlayer ? 70 : 35) * dt + Math.random());
      for (let i = 0; i < count; i++) {
        const sp = 3 + Math.random() * 6 + Math.abs(rw.slip) * 1.5;
        const wet = rw.mud > 0 && Math.random() < 0.8;
        this.particles.emit(
          'clod',
          rw.contactX,
          rw.contactY + 0.05 + off,
          -tx * sp + n.x * (1.5 + Math.random() * 4) + b.vx * 0.4,
          -ty * sp + n.y * (1.5 + Math.random() * (wet ? 6 : 4)),
          0.9,
          (wet ? 0.04 : 0.025) + Math.random() * 0.045,
          wet ? fx.style.mudColor : Math.random() < 0.5 ? g.pebble : g.crustShade,
        );
      }
      if (speed > 5 && Math.random() < dt * (8 + speed) * (isPlayer ? 1 : 0.5)) {
        this.particles.emit('dust', rw.contactX - 0.3, rw.contactY + 0.15 + off, -tx * 2 + b.vx * 0.3, 0.4 + Math.random() * 0.6, 0.9 + Math.random() * 0.6, 0.18 + Math.random() * 0.2, g.dust);
      }
    }
    if (fw.inContact && fw.mud > 0 && speed > 4 && Math.random() < dt * 25) {
      this.particles.emit('clod', fw.contactX + 0.2, fw.contactY + off, b.vx * 0.5 + Math.random() * 2, 2 + Math.random() * 3, 0.8, 0.04, fx.style.mudColor);
    }
    if (isPlayer && fw.inContact && b.brake > 0.3 && Math.abs(fw.slip) > 0.8 && Math.random() < dt * 30) {
      this.particles.emit('dust', fw.contactX, fw.contactY + 0.1, b.vx * 0.2, 0.5, 0.6, 0.18, g.dust);
    }
    if (isPlayer && b.nitro && this.race.state === 'racing') {
      const tip = exhaustTipWorld(b);
      const c = Math.cos(b.angle);
      const s = Math.sin(b.angle);
      for (let i = 0; i < 3; i++) {
        const sp = 4 + Math.random() * 4;
        this.particles.emit('flame', tip.x, tip.y, b.vx - c * sp, b.vy - s * sp + (Math.random() - 0.5), 0.18 + Math.random() * 0.12, 0.09 + Math.random() * 0.07, i === 0 ? '#9fe8ff' : '#ff8a2a');
      }
    }
  }

  // ---------------------------------------------------------------- dibujo
  /** Coloca el contexto en el carril: suelo del carril, escala y giro del chasis. */
  private laneTransform(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, lane: number): void {
    const g = this.race.track.terrain.heightAt(x);
    const sc = laneScale(lane);
    ctx.translate(x, g + laneOffset(lane));
    ctx.scale(sc, sc);
    ctx.translate(0, y - g);
    ctx.rotate(angle);
  }

  private drawRider(ctx: CanvasRenderingContext2D, fx: RiderFx, alpha: number): void {
    setStyle(fx.style);
    if (fx.ragdoll) {
      const r = fx.ragdoll;
      ctx.save();
      this.laneTransform(ctx, r.bike.x, r.bike.y, r.bike.a, fx.lane);
      drawBike(ctx, r.draw, null, false);
      ctx.restore();
      ctx.save();
      this.laneTransform(ctx, r.rider.x, r.rider.y, r.rider.a, fx.lane);
      drawRiderPose(ctx, flailPose(r.t));
      ctx.restore();
    } else if (!fx.rival || fx.rival.state !== 'out') {
      const src = fx.rival ?? this.race;
      const b = lerpBike(src.prevBike, src.bike, alpha);
      this.drawShadow(ctx, b, fx.lane);
      ctx.save();
      this.laneTransform(ctx, b.x, b.y, b.angle, fx.lane);
      drawBike(ctx, bikeDrawState(b), fx.rig.pose(), !fx.rival && b.nitro && this.race.state === 'racing');
      ctx.restore();
    }
    setStyle(null);
  }

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, alpha: number, dt: number): View {
    const race = this.race;
    const v = this.camera.view(W, H, dpr);
    const time = this.time;
    const theme = race.mission.theme;

    screenTransform(ctx, v);
    this.backdrop.draw(ctx, v, time);

    worldTransform(ctx, v);
    this.world.drawProps(ctx, v, 1, time);
    this.particles.draw(ctx, v, 'back');
    this.world.drawTerrain(ctx, v, time);
    this.world.drawObstacles(ctx, v);
    const gate = race.state === 'countdown' ? 0 : clamp(race.time * 4 + 0.05, 0, 1);
    this.world.drawGates(ctx, v, race.lastCheckpoint, time, gate);
    this.world.drawProps(ctx, v, 0, time);
    this.world.drawPickups(ctx, v, race.track.pickups, race.collected, time);

    this.drawGhosts(ctx);
    for (const fx of this.riders) this.drawRider(ctx, fx, alpha);
    this.particles.draw(ctx, v, 'front');
    if (race.mission.objective === 'storm') this.world.drawStorm(ctx, v, race.stormX, time);

    screenTransform(ctx, v);
    if (!this.clean) this.drawTags(ctx, v);
    this.weather.draw(ctx, v, dt, time);
    if (theme.night) this.nightLights(ctx, v);
    this.postFx(ctx, v);
    if (!this.clean) this.lens.draw(ctx, W, H);
    return v;
  }

  private drawGhosts(ctx: CanvasRenderingContext2D): void {
    for (const g of [...this.ghosts].reverse()) {
      if (!g.bike) continue;
      setStyle(g.style);
      ctx.save();
      ctx.globalAlpha = 0.55;
      this.laneTransform(ctx, g.bike.x, g.bike.y, g.bike.angle, g.lane);
      drawBike(ctx, bikeDrawState(g.bike), g.rig.pose(), false);
      ctx.restore();
      setStyle(null);
    }
  }

  /** Dorsal y nombre encima de cada rival. */
  private drawTags(ctx: CanvasRenderingContext2D, v: View): void {
    ctx.font = '800 12px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const g of this.ghosts) {
      if (!g.bike) continue;
      const gr = this.race.track.terrain.heightAt(g.bike.x);
      const p = toScreen(v, g.bike.x, Math.max(g.bike.y, gr) + laneOffset(g.lane) + 1.55);
      p.y -= (g.lane - 1) * 19;
      if (p.x < -60 || p.x > v.W + 60) continue;
      const w = ctx.measureText(g.label).width + 14;
      ctx.fillStyle = 'rgba(235,245,255,0.16)';
      ctx.strokeStyle = 'rgba(235,245,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, p.y - 9, w, 18, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f4f8ff';
      ctx.fillText(g.label, p.x, p.y + 1);
    }
    for (const fx of this.riders) {
      const r = fx.rival;
      if (!r || r.state === 'out' || fx.ragdoll) continue;
      const b = r.bike;
      const g = this.race.track.terrain.heightAt(b.x);
      const p = toScreen(v, b.x, Math.max(b.y, g) + laneOffset(fx.lane) + 1.55);
      p.y -= (fx.lane - 1) * 19;
      if (p.x < -40 || p.x > v.W + 40) continue;
      const label = `#${r.spec.number} ${r.spec.name}`;
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(10,12,20,0.7)';
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, p.y - 9, w, 18, 4);
      ctx.fill();
      ctx.fillStyle = fx.style.livery.plastic;
      ctx.fillRect(p.x - w / 2, p.y - 9, 3, 18);
      ctx.fillStyle = '#f4f2ec';
      ctx.fillText(label, p.x + 1, p.y + 1);
    }
  }

  private drawShadow(ctx: CanvasRenderingContext2D, b: BikeState, lane: number): void {
    const t = this.race.track.terrain;
    const g = t.heightAt(b.x);
    const hgt = b.y - g;
    const a = clamp(0.35 - hgt * 0.04, 0.05, 0.35);
    ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(b.x, g + 0.02 + laneOffset(lane), (1.0 + hgt * 0.06) * laneScale(lane), 0.08, Math.atan(t.slopeAt(b.x)), 0, Math.PI * 2);
    ctx.fill();
  }

  private nightLights(ctx: CanvasRenderingContext2D, v: View): void {
    const { W, H } = v;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.race.track.props) {
      if (p.kind !== 'light') continue;
      const sx = (p.x - v.cx) * v.ppm + W / 2;
      if (sx < -W * 0.6 || sx > W * 1.6) continue;
      const top = this.race.track.terrain.heightAt(p.x) + 9.3 * p.scale * (p.depth ? 0.82 : 1);
      const sy = H / 2 - (top - v.cy) * v.ppm;
      const beam = ctx.createRadialGradient(sx, sy, 4, sx, sy, H * 0.9);
      beam.addColorStop(0, 'rgba(210,228,255,0.35)');
      beam.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy);
      ctx.lineTo(sx + 12, sy);
      ctx.lineTo(sx + H * 0.55, sy + H * 1.1);
      ctx.lineTo(sx - H * 0.25, sy + H * 1.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private vignette: { canvas: HTMLCanvasElement; W: number; H: number } | null = null;

  private postFx(ctx: CanvasRenderingContext2D, v: View): void {
    const { W, H } = v;
    if (!this.vignette || this.vignette.W !== W || this.vignette.H !== H) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(W / 3));
      c.height = Math.max(1, Math.round(H / 3));
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      const cw = c.width;
      const ch = c.height;
      const vg = g.createRadialGradient(cw / 2, ch * 0.48, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, this.race.mission.theme.night ? 'rgba(0,0,10,0.55)' : 'rgba(20,8,0,0.32)');
      g.fillStyle = vg;
      g.fillRect(0, 0, cw, ch);
      this.vignette = { canvas: c, W, H };
    }
    ctx.drawImage(this.vignette.canvas, 0, 0, W, H);
    const b = this.race.bike;
    if (b.nitro && this.race.state === 'racing') {
      ctx.strokeStyle = 'rgba(180,235,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const y = ((i * 97.3 + this.time * 900) % H + H) % H;
        const x = ((i * 211.7 + this.time * 2600) % W + W) % W;
        ctx.beginPath();
        ctx.moveTo(W - x, y);
        ctx.lineTo(W - x - 80, y);
        ctx.stroke();
      }
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.flash * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}



