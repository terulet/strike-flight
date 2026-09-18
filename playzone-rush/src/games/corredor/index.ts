/**
 * CORREDOR - saltar o agacharse, y cada vez mas rapido.
 *
 * Dos acciones, no una: los obstaculos bajos se saltan y las vigas altas se
 * pasan deslizandose. Elegir mal es tan malo como llegar tarde, y eso obliga
 * a mirar lo que viene en vez de aporrear.
 *
 * Habilidad que mide: reaccion con decision, no solo ritmo.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#f97316';

interface Obstaculo {
  x: number;
  ancho: number;
  alto: number;
  /** true = viga alta (hay que deslizarse), false = bloque en el suelo. */
  alta: boolean;
  pasado: boolean;
}

export const META: GameMeta = {
  id: 'corredor',
  name: 'CORREDOR',
  tagline: 'Arriba para saltar, abajo para deslizarte.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca ARRIBA para saltar los bloques del suelo.',
    'Toca ABAJO para deslizarte bajo las vigas.',
    'Chocar cuesta una vida y te frena en seco.',
  ],
  icon: '🏃',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'heavy', 'sprint', 'rush', 'swarm', 'chaos'],
};

class CorredorGame extends BaseMiniGame {
  readonly meta = META;

  private obstaculos: Obstaculo[] = [];
  private y = 0;
  private vy = 0;
  private enSuelo = true;
  private deslizando = 0;
  private pasados = 0;
  private choques = 0;
  private invulnerable = 0;
  private time = 0;
  private freno = 1;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.obstaculos = [];
    this.y = 0;
    this.vy = 0;
    this.enSuelo = true;
    this.deslizando = 0;
    this.pasados = 0;
    this.choques = 0;
    this.invulnerable = 0;
    this.freno = 1;
    this.time = 0;
    this.tracksAccuracy = false;
    this.setLives(3);
    this.crear(this.width * 1.1);
  }

  private get sueloY(): number {
    return this.areaBottom - Math.max(30, this.areaHeight * 0.08);
  }

  private get altoCorredor(): number {
    return Math.min(this.areaHeight * 0.16, this.width * 0.16) * this.mut.sizeMultiplier;
  }

  private get gravedad(): number {
    return this.areaHeight * 4.2 * Math.max(0.5, this.mut.gravity);
  }

  private get velocidad(): number {
    const base = this.width * (0.45 + this.config.difficulty * 0.2 + this.progress * 0.38);
    return base * Math.max(0.5, this.mut.speed) * this.freno;
  }

  private crear(x: number): void {
    const alta = this.rng.chance(0.42);
    const alto = alta ? this.altoCorredor * 0.62 : this.altoCorredor * this.rng.range(0.42, 0.7);
    this.obstaculos.push({
      x,
      ancho: this.width * this.rng.range(0.06, 0.11),
      alto,
      alta,
      pasado: false,
    });
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.deslizando = Math.max(0, this.deslizando - dt);
    this.freno = Math.min(1, this.freno + dt * 0.8);

    for (const punto of this.tapPoints()) {
      if (punto.y < (this.areaTop + this.areaBottom) / 2) this.saltar();
      else this.deslizar();
    }
    for (const code of this.services.input.keyTaps) {
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') this.saltar();
      if (code === 'ArrowDown' || code === 'KeyS') this.deslizar();
    }

    if (!this.enSuelo) {
      this.vy += this.gravedad * dt;
      this.y += this.vy * dt;
      if (this.y >= 0) {
        this.y = 0;
        this.vy = 0;
        this.enSuelo = true;
      }
    }

    const avance = this.velocidad * dt;
    for (let i = this.obstaculos.length - 1; i >= 0; i--) {
      const obs = this.obstaculos[i] as Obstaculo;
      obs.x -= avance;
      if (!obs.pasado && obs.x + obs.ancho < this.corredorX) {
        obs.pasado = true;
        this.pasados++;
        const combo = this.bumpCombo();
        this.addScore(Math.round(70 * (1 + Math.min(12, combo) * 0.07)), this.corredorX, this.sueloY);
        this.services.audio.play('hit');
      }
      if (obs.x + obs.ancho < -20) this.obstaculos.splice(i, 1);
    }

    const ultimo = this.obstaculos.reduce((max, o) => Math.max(max, o.x), 0);
    const separacion = this.width * Math.max(0.36, 0.72 - this.progress * 0.22);
    if (ultimo < this.width - separacion) this.crear(this.width + 20);

    this.comprobarChoque();
  }

  private saltar(): void {
    if (!this.enSuelo) return;
    this.enSuelo = false;
    this.deslizando = 0;
    this.vy = -Math.sqrt(2 * this.gravedad * this.altoCorredor * 1.55);
    this.services.audio.play('tap');
    this.services.haptics.fire('tick');
  }

  private deslizar(): void {
    if (!this.enSuelo) return;
    this.deslizando = 0.45;
    this.services.audio.play('select');
  }

  private get corredorX(): number {
    return this.width * 0.22;
  }

  private comprobarChoque(): void {
    if (this.invulnerable > 0) return;
    const ancho = this.altoCorredor * 0.5;
    const altoActual = this.deslizando > 0 ? this.altoCorredor * 0.45 : this.altoCorredor;
    const top = this.sueloY + this.y - altoActual;
    const bottom = this.sueloY + this.y;

    for (const obs of this.obstaculos) {
      if (this.corredorX + ancho / 2 < obs.x || this.corredorX - ancho / 2 > obs.x + obs.ancho) continue;
      const obsTop = obs.alta ? this.sueloY - this.altoCorredor : this.sueloY - obs.alto;
      const obsBottom = obs.alta ? this.sueloY - this.altoCorredor + obs.alto : this.sueloY;
      if (bottom <= obsTop || top >= obsBottom) continue;

      this.choques++;
      this.registerMistake(0);
      this.announce(obs.alta ? 'AGACHATE' : 'SALTA', 'bad');
      this.services.audio.play('defeat');
      this.services.haptics.fire('heavy');
      this.services.fx.flash('#ef4444', 0.26);
      this.services.fx.shake(8);
      this.invulnerable = 0.9;
      this.freno = 0.25; // arranca de nuevo: el choque cuesta ritmo, no la partida
      obs.pasado = true;
      return;
    }
  }

  protected draw(): void {
    const ctx = this.ctx;
    const suelo = this.sueloY;

    ctx.save();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, suelo);
    ctx.lineTo(this.width, suelo);
    ctx.stroke();
    // Marcas del suelo corriendo hacia atras: sin esto no se percibe velocidad.
    ctx.globalAlpha = 0.12;
    const paso = 46;
    const desfase = (this.time * this.velocidad) % paso;
    for (let x = -desfase; x < this.width; x += paso) {
      ctx.beginPath();
      ctx.moveTo(x, suelo + 6);
      ctx.lineTo(x + 14, suelo + 6);
      ctx.stroke();
    }
    ctx.restore();

    for (const obs of this.obstaculos) {
      const y = obs.alta ? suelo - this.altoCorredor : suelo - obs.alto;
      ctx.fillStyle = obs.alta ? '#a855f7' : ACCENT;
      roundRect(ctx, obs.x, y, obs.ancho, obs.alto, 5);
      ctx.fill();
    }

    const alto = this.deslizando > 0 ? this.altoCorredor * 0.45 : this.altoCorredor;
    const ancho = this.altoCorredor * 0.5;
    const y = suelo + this.y - alto;
    ctx.save();
    if (this.invulnerable > 0) ctx.globalAlpha = 0.45 + Math.sin(this.time * 30) * 0.3;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, this.corredorX - ancho / 2, y, ancho, alto, ancho * 0.3);
    ctx.fill();
    ctx.restore();

    label(ctx, 'ARRIBA SALTA · ABAJO DESLIZA', this.width / 2, this.areaTop + 14, {
      size: 11,
      color: hexToRgba('#ffffff', 0.3),
    });
  }

  protected override metrics(): Record<string, number> {
    return { pasados: this.pasados, choques: this.choques };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'corredor', obstaculos: this.obstaculos.length, enSuelo: this.enSuelo };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new CorredorGame(services, config),
};
