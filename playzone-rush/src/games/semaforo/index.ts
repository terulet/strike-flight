/**
 * SEMAFORO - reflejos en estado puro.
 *
 * Se pone verde: tocas. Cuanto antes, mas puntos. Pero hay una trampa, y es la
 * que hace que pique: si tocas antes de tiempo es salida falsa y cuesta vida.
 * Aguantar el dedo quieto cuesta mas que moverlo rapido.
 *
 * Habilidad que mide: tiempo de reaccion limpio, sin punteria de por medio.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { backdropGrid, glowCircle, hexToRgba, label } from '../../game/draw';

const ACCENT = '#22c55e';
const ROJO = '#ef4444';
const AMBAR = '#f59e0b';

type Fase = 'roja' | 'ambar' | 'verde' | 'pausa';

export const META: GameMeta = {
  id: 'semaforo',
  name: 'SEMAFORO',
  tagline: 'Toca en cuanto se ponga verde. Ni antes.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: [
    'Espera a que la luz se ponga VERDE y toca donde sea.',
    'Cuanto antes toques, mas puntos.',
    'Tocar en ROJO o en AMBAR es salida falsa: cuesta una vida.',
  ],
  icon: '🚦',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['double', 'onelife', 'blackout', 'sprint', 'rush', 'chaos'],
};

class SemaforoGame extends BaseMiniGame {
  readonly meta = META;

  private fase: Fase = 'roja';
  private faseTimer = 0;
  /** Se pone a 0 al encender el verde y cuenta lo que tarda el dedo. */
  private reaccion = 0;
  private ultima = 0;
  private mejor = 0;
  private salidasFalsas = 0;
  private rondas = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.fase = 'roja';
    this.faseTimer = this.esperaRoja();
    this.reaccion = 0;
    this.ultima = 0;
    this.mejor = 0;
    this.salidasFalsas = 0;
    this.rondas = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
  }

  /** La espera se acorta con la dificultad, pero nunca es predecible. */
  private esperaRoja(): number {
    const base = 1.9 - this.config.difficulty * 0.5 - this.progress * 0.3;
    return Math.max(0.55, this.rng.range(base * 0.45, base));
  }

  /** Ventana para reaccionar antes de que se considere perdida. */
  private get ventana(): number {
    return Math.max(0.5, (1.1 - this.config.difficulty * 0.25) / Math.max(0.6, this.mut.speed));
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.faseTimer -= dt;

    if (this.fase === 'verde') this.reaccion += dt;

    const tocado = this.tapPoints().length > 0 || this.services.input.keyTaps.length > 0;

    switch (this.fase) {
      case 'roja':
      case 'ambar': {
        if (tocado) {
          this.salidaFalsa();
          return;
        }
        if (this.faseTimer > 0) return;
        // Del rojo se puede pasar al ambar (amago) o directo al verde.
        if (this.fase === 'roja' && this.rng.chance(0.28)) {
          this.fase = 'ambar';
          this.faseTimer = this.rng.range(0.35, 0.8);
          return;
        }
        this.fase = 'verde';
        this.faseTimer = this.ventana;
        this.reaccion = 0;
        this.services.audio.play('go');
        return;
      }
      case 'verde': {
        if (tocado) {
          this.acierto();
          return;
        }
        if (this.faseTimer <= 0) {
          // Se ha ido el verde sin tocarlo.
          this.misses++;
          this.breakCombo();
          this.announce('SE TE HA PASADO', 'bad');
          this.services.audio.play('miss');
          this.nuevaRonda(0.35);
        }
        return;
      }
      case 'pausa': {
        if (this.faseTimer <= 0) {
          this.fase = 'roja';
          this.faseTimer = this.esperaRoja();
        }
        return;
      }
    }
  }

  private salidaFalsa(): void {
    this.salidasFalsas++;
    this.registerMistake(30);
    this.announce('SALIDA FALSA', 'bad');
    this.services.audio.play('error');
    this.services.haptics.fire('error');
    this.services.fx.flash(ROJO, 0.28);
    this.services.fx.shake(6);
    this.nuevaRonda(0.5);
  }

  private acierto(): void {
    const ms = Math.round(this.reaccion * 1000);
    this.ultima = ms;
    if (this.mejor === 0 || ms < this.mejor) this.mejor = ms;
    this.rondas++;
    this.registerHit();
    const combo = this.bumpCombo();
    // 180 ms es reaccion humana de elite; de ahi para abajo no se reparte mas.
    const crudo = Math.max(20, 420 - Math.max(0, ms - 180) * 0.9);
    const multiplicador = 1 + Math.min(8, combo) * 0.06;
    this.addScore(Math.round(crudo * multiplicador), this.width / 2, this.centroY);
    this.services.audio.play(ms < 260 ? 'record' : 'hit');
    this.services.haptics.fire('light');
    this.services.fx.burst(this.width / 2, this.centroY, {
      count: ms < 260 ? 26 : 14,
      color: ACCENT,
      speed: 300,
      size: 5,
    });
    this.services.fx.float(this.width / 2, this.centroY - 40, `${ms} ms`, { color: ACCENT, size: 26 });
    this.nuevaRonda(0.55);
  }

  private nuevaRonda(pausa: number): void {
    this.fase = 'pausa';
    this.faseTimer = pausa;
  }

  private get centroY(): number {
    return this.areaTop + this.areaHeight * 0.44;
  }

  protected draw(): void {
    const ctx = this.ctx;
    const color = this.fase === 'verde' ? ACCENT : this.fase === 'ambar' ? AMBAR : ROJO;
    backdropGrid(ctx, this.width, this.height, color, this.time * 10, this.width / 3);

    const cx = this.width / 2;
    const cy = this.centroY;
    const radio = Math.min(this.width * 0.3, this.areaHeight * 0.2);

    // Las tres luces, en vertical como un semaforo de verdad.
    const luces: { color: string; encendida: boolean }[] = [
      { color: ROJO, encendida: this.fase === 'roja' || this.fase === 'pausa' },
      { color: AMBAR, encendida: this.fase === 'ambar' },
      { color: ACCENT, encendida: this.fase === 'verde' },
    ];
    const paso = radio * 1.5;
    const arriba = cy - paso;

    for (let i = 0; i < luces.length; i++) {
      const luz = luces[i] as { color: string; encendida: boolean };
      const y = arriba + paso * i;
      if (luz.encendida) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        glowCircle(ctx, cx, y, radio * 1.35, luz.color, 40);
        ctx.restore();
        glowCircle(ctx, cx, y, radio * 0.62, luz.color, 26);
      } else {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = luz.color;
        ctx.beginPath();
        ctx.arc(cx, y, radio * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const pie = this.areaBottom - 52;
    if (this.fase === 'verde') {
      label(ctx, 'AHORA', cx, pie, { size: 34, color: ACCENT });
    } else if (this.fase === 'ambar') {
      label(ctx, 'TODAVIA NO', cx, pie, { size: 24, color: hexToRgba(AMBAR, 0.95) });
    } else {
      label(ctx, 'ESPERA', cx, pie, { size: 24, color: hexToRgba('#ffffff', 0.45) });
    }

    if (this.ultima > 0) {
      label(ctx, `ULTIMA ${this.ultima} ms · MEJOR ${this.mejor} ms`, cx, pie + 30, {
        size: 14,
        color: hexToRgba('#ffffff', 0.55),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return {
      rondas: this.rondas,
      mejorMs: this.mejor,
      salidasFalsas: this.salidasFalsas,
    };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'semaforo', fase: this.fase, faseTimer: this.faseTimer, mejor: this.mejor };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new SemaforoGame(services, config),
};
