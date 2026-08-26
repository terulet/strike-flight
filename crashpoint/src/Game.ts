import Matter from 'matter-js';
import { EventBus } from './core/EventBus';
import type { GameEvents } from './core/events';
import { GameLoop } from './core/GameLoop';
import { Telemetry } from './core/Telemetry';
import { loadRecord, mergeRunIntoRecord, saveRecord } from './core/Persistence';
import type { ProjectileId, Vec2 } from './core/types';

import { PhysicsWorld } from './physics/PhysicsWorld';
import { buildTheTower, type BuiltTower } from './game/TheTower';
import type { StructuralPiece } from './entities/StructuralPiece';
import { Projectile, PROJECTILES } from './entities/Projectile';

import { DamageSystem } from './systems/DamageSystem';
import { ChainReactionSystem } from './systems/ChainReactionSystem';
import { CameraSystem, type CameraView } from './systems/CameraSystem';
import { ShotSystem } from './systems/ShotSystem';
import { SlowMotionSystem } from './systems/SlowMotionSystem';
import { ExplosionSystem } from './systems/ExplosionSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { EndConditionSystem } from './systems/EndConditionSystem';
import { computeMedal, computeScore, isPerfectCollapse, MAX_SHOTS } from './systems/ScoreSystem';

import { AudioEngine } from './audio/AudioEngine';
import { Renderer } from './render/Renderer';

import { StartScreen } from './ui/StartScreen';
import { HUD } from './ui/HUD';
import { ResultScreen } from './ui/ResultScreen';
import { DebugOverlay } from './debug/DebugOverlay';

type Screen = 'start' | 'playing' | 'result';

/**
 * Top-level orchestrator: wires physics/systems/UI together and owns the run lifecycle
 * (section 28: RETRY must fully rebuild the world, no leaked bodies/listeners between runs).
 */
export class Game {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private loop!: GameLoop;

  private physics = new PhysicsWorld();
  private bus = new EventBus<GameEvents>();
  private telemetry = new Telemetry();
  private tower!: BuiltTower;

  private damage!: DamageSystem;
  private chain!: ChainReactionSystem;
  private camera: CameraSystem;
  private shot!: ShotSystem;
  private slowMo: SlowMotionSystem;
  private explosionSystem!: ExplosionSystem;
  private particles = new ParticleSystem();
  private endCondition = new EndConditionSystem();
  private audio: AudioEngine;

  private startScreen: StartScreen;
  private hud: HUD;
  private resultScreen: ResultScreen;
  private debugOverlay: DebugOverlay;

  private projectiles = new Map<string, Projectile>();
  private projectileCounter = 0;
  private trackedProjectileId: string | null = null;
  private lastDramaticFocusMs = -Infinity;
  private nearCollapseTriggered = false;
  private graceStartedAtSimMs = 0;
  private readonly GRACE_MS = 1500;

  private screen: Screen = 'start';
  private startedAtMs = 0;
  private nowMs = 0;
  private fps = 60;
  private fpsAccum = 0;
  private fpsFrames = 0;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:absolute;inset:0;';
    container.appendChild(this.root);

    this.canvas = document.createElement('canvas');
    this.root.appendChild(this.canvas);
    this.renderer = new Renderer(this.canvas);

    this.camera = new CameraSystem({ x: 850, y: 560, zoom: 0.62 }, 0.55, 1.7);

    this.loop = new GameLoop(
      (dtMs) => this.fixedUpdate(dtMs),
      (_alpha, realDtMs) => this.render(realDtMs)
    );

    this.audio = new AudioEngine(this.bus, (pieceId) => this.tower.pieces.get(pieceId)?.material);
    this.slowMo = new SlowMotionSystem(this.loop, this.bus);

    this.startScreen = new StartScreen(() => this.startGame());
    this.hud = new HUD((id) => this.selectProjectile(id));
    this.resultScreen = new ResultScreen(
      () => this.retry(),
      () => {
        /* NEXT is disabled in this vertical slice — see section 26 */
      }
    );
    this.debugOverlay = new DebugOverlay(() => this.retry());

    this.root.appendChild(this.startScreen.el);
    this.root.appendChild(this.hud.el);
    this.root.appendChild(this.resultScreen.el);
    this.root.appendChild(this.debugOverlay.el);

    this.buildLevel();
    this.wireEvents();
    this.wireInput();
    this.wireDebugToggle();

    const ro = new ResizeObserver(() => this.handleResize());
    ro.observe(container);
    this.handleResize();

    if (new URLSearchParams(location.search).get('debug') === '1') this.debugOverlay.toggle();

    this.loop.start();
  }

  // ---------------------------------------------------------------------------------------
  // Level lifecycle
  // ---------------------------------------------------------------------------------------

  private buildLevel(): void {
    this.tower = buildTheTower(this.physics);
    this.damage = new DamageSystem(this.physics, this.tower.pieces, this.projectiles, this.bus);
    this.chain = new ChainReactionSystem(this.bus, () => this.nowMs);
    this.shot = new ShotSystem(this.tower.data.launcherOrigin, this.bus);
    this.explosionSystem = new ExplosionSystem(this.tower.pieces, this.damage, this.bus);
    this.projectiles.clear();
    this.projectileCounter = 0;
    this.trackedProjectileId = null;
    this.nearCollapseTriggered = false;
    this.camera.reset();
    this.particles.clear();
    this.endCondition.reset();
    this.slowMo?.reset();
    this.damage.graceActive = true;
    this.graceStartedAtSimMs = this.nowMs;
  }

  private newRun(): void {
    this.physics.reset();
    this.buildLevel();
    this.telemetry.start(performance.now());
    this.telemetry.log('game_start', { level: this.tower.data.name });
    this.startedAtMs = performance.now();
    this.hud.reset();
  }

  startGame(): void {
    this.startScreen.hide();
    this.hud.show();
    this.resultScreen.hide();
    this.screen = 'playing';
    this.newRun();
    this.bus.emit('game_start', { atMs: this.startedAtMs });
  }

  retry(): void {
    this.telemetry.log('retry', {});
    this.resultScreen.hide();
    this.hud.show();
    this.screen = 'playing';
    this.newRun();
    this.bus.emit('game_start', { atMs: this.startedAtMs });
  }

  // ---------------------------------------------------------------------------------------
  // Event wiring (chain reaction feedback loop: camera + particles + slow motion + telemetry)
  // ---------------------------------------------------------------------------------------

  private wireEvents(): void {
    this.bus.on('shot_aim_start', (e) => this.telemetry.log('shot_aim_start', e));
    this.bus.on('shot_fired', (e) => {
      this.telemetry.log('shot_fired', { projectile: e.projectile, shotIndex: e.shotIndex });
      this.telemetry.log('projectile_type', { projectile: e.projectile });
      this.spawnProjectile(e.projectile, e.origin, e.velocity);
      this.endCondition.notifyShotFired(this.nowMs);
    });

    this.bus.on('impact', (e) => {
      this.telemetry.log('impact', { pieceId: e.pieceId, impulse: e.impulse });
      const piece = this.tower.pieces.get(e.pieceId);
      if (piece) this.particles.burstImpact(e.point.x, e.point.y, piece.material);

      const proj = this.projectiles.get(e.causeId);
      if (proj?.config.pulse && !proj.hasPulsed) {
        proj.hasPulsed = true;
        this.bus.emit('explosion', { pieceId: `pulse_${proj.id}`, causeId: proj.id, point: e.point, radius: proj.config.pulse.radius });
      }
    });

    this.bus.on('structural_break', (e) => {
      this.telemetry.log('structural_break', { pieceId: e.pieceId, material: e.material });
      this.particles.burstBreak(e.point.x, e.point.y, e.material);
      this.focusDrama(e.point, this.chain.getCurrentChainLength() >= 2 ? 'chain' : 'impact');

      const piece = this.tower.pieces.get(e.pieceId);
      if (piece?.role === 'primary') {
        this.bus.emit('slow_motion_trigger', { reason: 'critical_break', strength: 0.5, durationMs: 450 });
      }
    });

    this.bus.on('explosion', (e) => {
      this.telemetry.log('explosion', { pieceId: e.pieceId });
      this.particles.burstExplosion(e.point.x, e.point.y);
      this.focusDrama(e.point, 'chain');
      this.bus.emit('slow_motion_trigger', { reason: 'explosion', strength: 0.45, durationMs: 500 });
    });

    this.bus.on('chain_start', (e) => this.telemetry.log('chain_start', e));
    this.bus.on('chain_event', (e) => {
      this.hud.showChain(e.chainLength);
    });
    this.bus.on('chain_end', (e) => this.telemetry.log('chain_length', { chainLength: e.chainLength }));

    this.bus.on('destruction_progress', (e) => {
      this.telemetry.log('destruction_percent', { percent: e.percent });
      if (e.percent >= 90 && !this.nearCollapseTriggered) {
        this.nearCollapseTriggered = true;
        this.bus.emit('destruction_event', { kind: 'mega_collapse', point: this.tower.data.launcherOrigin, magnitude: 3 });
        this.bus.emit('slow_motion_trigger', { reason: 'near_total_collapse', strength: 0.4, durationMs: 750 });
        this.particles.burstMegaCollapse(this.tower.data.worldWidth * 0.5, this.tower.data.groundY - 200);
        this.audio.playMegaCollapse();
        this.camera.focusCollapse({ x: this.tower.data.worldWidth * 0.5, y: this.tower.data.groundY - 250 });
        this.lastDramaticFocusMs = this.nowMs;
      }
    });

    this.bus.on('shots_changed', (e) => this.hud.setProjectileSelection(this.shot.selected, e.remaining));
  }

  private focusDrama(point: Vec2, kind: 'impact' | 'chain'): void {
    if (kind === 'impact') this.camera.focusImpact(point);
    else this.camera.focusChain(point);
    this.lastDramaticFocusMs = this.nowMs;
  }

  // ---------------------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------------------

  private wireInput(): void {
    const toWorld = (clientX: number, clientY: number): Vec2 => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * this.renderer.dpr;
      const y = (clientY - rect.top) * this.renderer.dpr;
      return this.renderer.screenToWorld(this.camera.current, x, y);
    };

    this.canvas.addEventListener('pointerdown', (evt) => {
      if (this.screen !== 'playing') return;
      this.audio.unlock();
      this.canvas.setPointerCapture(evt.pointerId);
      this.shot.startAim(toWorld(evt.clientX, evt.clientY));
    });
    this.canvas.addEventListener('pointermove', (evt) => {
      if (this.screen !== 'playing') return;
      this.shot.updateAim(toWorld(evt.clientX, evt.clientY));
    });
    const release = (evt: PointerEvent) => {
      if (this.screen !== 'playing') return;
      this.shot.fire();
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', () => this.shot.cancelAim());
  }

  private wireDebugToggle(): void {
    window.addEventListener('keydown', (evt) => {
      if (evt.key === 'd' || evt.key === 'D') this.debugOverlay.toggle();
    });
  }

  private selectProjectile(id: ProjectileId): void {
    this.shot.selectProjectile(id);
    this.hud.setProjectileSelection(this.shot.selected, this.shot.shotsRemaining);
  }

  // ---------------------------------------------------------------------------------------
  // Projectile spawning
  // ---------------------------------------------------------------------------------------

  private spawnProjectile(id: ProjectileId, origin: Vec2, velocity: Vec2): void {
    const cfg = PROJECTILES[id];
    const body = Matter.Bodies.circle(origin.x, origin.y, cfg.radius, {
      density: cfg.density,
      restitution: cfg.restitution,
      friction: cfg.friction,
      frictionAir: cfg.piercing ? 0.0005 : 0.002,
      label: `proj_${id}`,
    });
    Matter.Body.setVelocity(body, velocity);
    this.physics.addBody(body);

    const entityId = `proj_${this.projectileCounter++}`;
    const projectile = new Projectile(entityId, body, cfg, this.nowMs);
    this.damage.registerProjectile(projectile);
    this.trackedProjectileId = entityId;
    this.bus.emit('projectile_spawned', { entityId, projectile: id });
  }

  private cleanupProjectiles(): void {
    const bounds = this.tower.data;
    for (const [id, proj] of Array.from(this.projectiles)) {
      const p = proj.body.position;
      const outOfBounds = p.y > bounds.worldHeight + 400 || p.x < -400 || p.x > bounds.worldWidth + 400;
      const asleep = proj.body.speed < 0.05 && this.nowMs - proj.spawnedAtMs > 2500;
      if (outOfBounds || asleep) {
        this.physics.removeBody(proj.body);
        this.damage.unregisterProjectileBody(proj.body.id);
        this.projectiles.delete(id);
        if (this.trackedProjectileId === id) this.trackedProjectileId = null;
      }
    }
  }

  // ---------------------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------------------

  private fixedUpdate(dtMs: number): void {
    this.nowMs += dtMs;
    if (this.screen !== 'playing') return;

    this.physics.step(dtMs);
    this.chain.update(this.nowMs);
    this.cleanupProjectiles();

    if (this.damage.graceActive && this.nowMs - this.graceStartedAtSimMs > this.GRACE_MS) {
      this.damage.graceActive = false;
    }

    if (this.nowMs - this.lastDramaticFocusMs > 260) {
      const tracked = this.trackedProjectileId ? this.projectiles.get(this.trackedProjectileId) : null;
      if (tracked) this.camera.followProjectile(tracked.body.position);
      else this.camera.toPreparation();
    }

    const maxSpeed = this.computeMaxBodySpeed();
    const finished = this.endCondition.update(
      this.nowMs,
      maxSpeed,
      this.debugOverlay.state.unlimitedShots ? 1 : this.shot.shotsRemaining,
      this.projectiles.size
    );
    if (finished) this.finishGame();
  }

  private computeMaxBodySpeed(): number {
    let max = 0;
    for (const body of Matter.Composite.allBodies(this.physics.world)) {
      if (body.isStatic || body.isSleeping) continue;
      if (body.speed > max) max = body.speed;
    }
    return max;
  }

  private render(realDtMs: number): void {
    this.slowMo.update(realDtMs);
    this.camera.update();
    this.particles.update((realDtMs / 1000) * this.loop.timeScale);

    this.fpsAccum += realDtMs;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 400) {
      this.fps = (this.fpsFrames * 1000) / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    let aim: Vec2 | null = null;
    if (this.shot.aiming) {
      const preview = this.shot.getTrajectoryPreview();
      if (preview && preview.length > 0) {
        const first = preview[0];
        aim = { x: first.x - this.tower.data.launcherOrigin.x, y: first.y - this.tower.data.launcherOrigin.y };
      }
    }

    this.renderer.render({
      camera: this.camera.current,
      worldWidth: this.tower.data.worldWidth,
      worldHeight: this.tower.data.worldHeight,
      groundY: this.tower.data.groundY,
      decor: this.tower.data.decor,
      pieces: this.tower.pieces,
      projectiles: this.projectiles,
      particles: this.particles,
      trajectoryPreview: this.shot.getTrajectoryPreview(),
      launcherOrigin: this.tower.data.launcherOrigin,
      launcherAim: aim,
      showColliders: this.debugOverlay.state.showColliders,
      physics: this.physics,
    });

    if (this.screen === 'playing') {
      this.hud.setStats(this.damage.getDestructionPercent(), this.liveScore());
      this.hud.setProjectileSelection(this.shot.selected, this.debugOverlay.state.unlimitedShots ? MAX_SHOTS : this.shot.shotsRemaining);
      this.hud.setPower(this.shot.aiming ? this.shot.getPower() : null);
    }

    this.debugOverlay.update({
      fps: this.fps,
      pieces: this.tower.pieces,
      projectileCount: this.projectiles.size,
      bodyCount: Matter.Composite.allBodies(this.physics.world).length,
    });
  }

  private liveScore(): number {
    return computeScore({
      destructionPct: this.damage.getDestructionPercent(),
      shotsUsed: MAX_SHOTS - this.shot.shotsRemaining,
      bestChain: this.chain.bestChain,
      totalChainLinks: this.chain.totalChainLinks,
      timeMs: this.nowMs - this.startedAtMs,
      cleared: false,
    });
  }

  // ---------------------------------------------------------------------------------------
  // End of run
  // ---------------------------------------------------------------------------------------

  private finishGame(): void {
    this.screen = 'result';
    const destructionPct = this.damage.getDestructionPercent();
    const shotsUsed = MAX_SHOTS - this.shot.shotsRemaining;
    const bestChain = this.chain.bestChain;
    const cleared = destructionPct >= 80;
    const medal = computeMedal(destructionPct, shotsUsed);
    const perfect = isPerfectCollapse(destructionPct, shotsUsed);
    const timeMs = this.nowMs - this.startedAtMs;
    const score = computeScore({
      destructionPct,
      shotsUsed,
      bestChain,
      totalChainLinks: this.chain.totalChainLinks,
      timeMs,
      cleared,
    });

    if (perfect) this.bus.emit('perfect_collapse', { destructionPct });
    this.telemetry.log('shots_used', { shotsUsed });
    if (perfect) this.telemetry.log('perfect_collapse', { destructionPct });
    this.telemetry.log('game_finish', { destructionPct, score, medal });

    const previous = loadRecord();
    const { record, improved } = mergeRunIntoRecord(previous, {
      destructionPct,
      score,
      bestChain,
      shotsUsed,
      cleared,
      perfectCollapse: perfect,
    });
    saveRecord(record);

    this.bus.emit('game_finish', { destructionPct, score, shotsUsed, bestChain, medal, perfectCollapse: perfect, timeMs });
    this.camera.toResult();
    this.hud.hide();
    this.resultScreen.show({ destructionPct, score, shotsUsed, bestChain, medal, timeMs, record, improved });
  }

  // ---------------------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------------------

  private handleResize(): void {
    const rect = this.root.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
  }
}
