/**
 * Pruebas del contrato de minijuego usando un juego de mentira: si un juego
 * externo implementa esta interfaz, el shell le da todo esto gratis.
 */
import { describe, expect, it, vi } from 'vitest';
import { BaseMiniGame } from '../src/game/base';
import type { GameConfig, GameMeta, GameServices } from '../src/game/contract';
import { resolveMutators } from '../src/game/mutators';
import { AudioBus } from '../src/core/audio';
import { FxSystem } from '../src/core/fx';
import { Haptics } from '../src/core/haptics';
import { InputManager } from '../src/core/input';

const META: GameMeta = {
  id: 'fake',
  name: 'FAKE',
  tagline: 'juego de prueba',
  skill: 'reflejos',
  defaultDurationMs: 10_000,
  instructions: ['toca'],
  icon: '#',
  accent: '#fff',
  supportsGhost: true,
  scoreLabel: 'PTS',
};

class FakeGame extends BaseMiniGame {
  readonly meta = META;
  setupCount = 0;
  drawCount = 0;

  protected setup(): void {
    this.setupCount++;
    this.setLives(3);
  }
  protected tick(): void {
    /* nada */
  }
  protected draw(): void {
    this.drawCount++;
  }
  // Puertas para el test
  score10(): void {
    this.addScore(10, 5, 5);
  }
  chain(): number {
    return this.bumpCombo();
  }
  fail(): void {
    this.registerMistake(0);
  }
  hit(): void {
    this.registerHit();
    this.tracksAccuracy = true;
  }
  ghost(): void {
    this.passGhost('MARC 10s');
  }
}

function makeServices(): GameServices {
  const ctx = new Proxy(
    {},
    {
      get: () => () => undefined,
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    canvas: {} as HTMLCanvasElement,
    ctx,
    width: 393,
    height: 700,
    input: new InputManager(),
    audio: new AudioBus(true),
    haptics: new Haptics(false),
    fx: new FxSystem(),
  };
}

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  const mutatorIds = overrides.mutatorIds ?? [];
  return {
    seed: 'test-seed',
    durationMs: 10_000,
    difficulty: 0.3,
    mutators: resolveMutators(mutatorIds),
    mutatorIds,
    ghost: null,
    targetScore: null,
    targetName: null,
    ...overrides,
  };
}

describe('contrato de minijuego', () => {
  it('recorre los estados del ciclo de vida', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    expect(game.state).toBe('idle');
    game.start();
    expect(game.state).toBe('playing');
    game.pause();
    expect(game.state).toBe('paused');
    game.resume();
    expect(game.state).toBe('playing');
    game.destroy();
    expect(game.state).toBe('destroyed');
  });

  it('en pausa no avanza el reloj ni la logica', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    game.start();
    game.update(1);
    const left = game.hud().timeLeftMs;
    game.pause();
    game.update(5);
    expect(game.hud().timeLeftMs).toBe(left);
  });

  it('termina solo al agotarse el tiempo y emite el resultado', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    const onFinish = vi.fn();
    game.events.on('finish', onFinish);
    game.start();
    game.score10();
    for (let i = 0; i < 11; i++) game.update(1);
    expect(game.state).toBe('finished');
    expect(onFinish).toHaveBeenCalledOnce();
    const result = game.getResult();
    expect(result?.gameId).toBe('fake');
    expect(result?.endedBy).toBe('time');
    expect(result?.score).toBe(10);
    expect(result?.durationMs).toBe(10_000);
    expect(result?.seed).toBe('test-seed');
  });

  it('el multiplicador de puntos del mutador se aplica al sumar', () => {
    const game = new FakeGame(makeServices(), makeConfig({ mutatorIds: ['double'] }));
    game.start();
    game.score10();
    expect(game.score).toBe(20);
  });

  it('el mutador de una vida sustituye a las vidas del juego', () => {
    const normal = new FakeGame(makeServices(), makeConfig());
    normal.start();
    expect(normal.hud().maxLives).toBe(3);

    const brutal = new FakeGame(makeServices(), makeConfig({ mutatorIds: ['onelife'] }));
    brutal.start();
    expect(brutal.hud().maxLives).toBe(1);
    brutal.fail();
    expect(brutal.state).toBe('finished');
    expect(brutal.getResult()?.endedBy).toBe('death');
  });

  it('el combo sube, se rompe al fallar y se guarda el mejor', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    game.start();
    game.chain();
    game.chain();
    game.chain();
    expect(game.hud().combo).toBe(3);
    game.fail();
    expect(game.hud().combo).toBe(0);
    for (let i = 0; i < 11; i++) game.update(1);
    expect(game.getResult()?.bestCombo).toBe(3);
  });

  it('calcula la punteria cuando el juego la registra', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    game.start();
    game.hit();
    game.hit();
    game.hit();
    game.fail();
    for (let i = 0; i < 11; i++) game.update(1);
    expect(game.getResult()?.accuracy).toBeCloseTo(0.75);
  });

  it('restart() deja la partida como nueva (revancha instantanea)', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    game.start();
    game.score10();
    game.update(3);
    game.restart();
    expect(game.score).toBe(0);
    expect(game.state).toBe('playing');
    expect(game.hud().timeLeftMs).toBe(10_000);
    expect(game.setupCount).toBe(2);
  });

  it('el fantasma se avisa una sola vez', () => {
    const onGhost = vi.fn();
    const game = new FakeGame(
      makeServices(),
      makeConfig({
        ghost: { rivalId: 'marc', rivalName: 'MARC', kind: 'time', value: 5000, score: 3000 },
      }),
    );
    game.events.on('ghost', onGhost);
    game.start();
    game.ghost();
    game.ghost();
    expect(onGhost).toHaveBeenCalledOnce();
    expect(game.hud().ghostLabel).toBe('MARC 5.0 s');
  });

  it('el progreso del fantasma se calcula sobre el tiempo', () => {
    const game = new FakeGame(
      makeServices(),
      makeConfig({
        ghost: { rivalId: 'marc', rivalName: 'MARC', kind: 'time', value: 4000, score: 3000 },
      }),
    );
    game.start();
    game.update(2);
    expect(game.hud().ghostProgress).toBeCloseTo(0.5);
  });

  it('forceFinish permite cortar desde fuera', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    game.start();
    game.forceFinish('aborted');
    expect(game.getResult()?.endedBy).toBe('aborted');
  });

  it('render() delega en el draw del juego', () => {
    const game = new FakeGame(makeServices(), makeConfig());
    game.start();
    game.render();
    expect(game.drawCount).toBe(1);
  });
});
