/**
 * TRILE - seguir una cosa entre muchas iguales.
 *
 * Se enciende un disco, se apaga, todos se ponen a moverse y se cruzan. Cuando
 * paran, dime cual era.
 *
 * Es el juego de los trileros y funciona por la misma razon que en la calle:
 * no se puede resolver pensando, solo mirando, y la atencion se agota. A los
 * cinco discos el fallo deja de ser por torpeza y pasa a ser por un parpadeo.
 *
 * Es tambien el unico juego del catalogo donde NO se toca nada durante la
 * mayor parte de la partida, y eso le da un ritmo distinto a todo lo demas:
 * silencio, silencio, silencio, decision. Puesto detras de PULSE o de CUENTA
 * se nota el cambio de marcha, que es justo lo que se busca al variar el dia.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { backdropGrid, glowCircle, hexToRgba, label } from '../../game/draw';

const ACCENT = '#2dd4bf';
const FALLO = '#ff2d55';
const BIEN = '#4ade80';

type Fase = 'marcando' | 'barajando' | 'respondiendo' | 'revelando';

const MARCAR_S = 0.85;
const RESPONDER_S = 3.4;
const REVELAR_S = 0.7;

interface Disco {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bueno: boolean;
  brillo: number;
  color: string;
}

export const META: GameMeta = {
  id: 'trile',
  name: 'TRILE',
  tagline: 'Se enciende uno. No lo pierdas de vista.',
  skill: 'seguimiento',
  defaultDurationMs: 40_000,
  instructions: [
    'Se enciende un disco. Memoriza cual es.',
    'Todos se mueven y se cruzan. Siguelo con la vista.',
    'Cuando paren, tocalo. Cada ronda hay mas discos.',
  ],
  icon: '⦿',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['double', 'sprint', 'onelife', 'chaos', 'tiny'],
};

class TrileGame extends BaseMiniGame {
  readonly meta = META;

  private discos: Disco[] = [];
  private fase: Fase = 'marcando';
  private faseT = 0;
  private barajarS = 1.8;
  private ronda = 0;
  private aciertos = 0;
  private acertoLaUltima = false;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.ronda = 0;
    this.aciertos = 0;
    this.acertoLaUltima = false;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(null);
    this.nuevaRonda();
  }

  private get ramp(): number {
    return Math.min(1, this.progress * 0.35 + Math.min(1, this.ronda / 9) * 0.65 + this.config.difficulty * 0.25);
  }

  private get radio(): number {
    return Math.min(this.width, this.areaHeight) * 0.072 * this.mut.sizeMultiplier;
  }

  private nuevaRonda(): void {
    this.ronda++;
    const r = this.ramp;
    const cuantos = 3 + Math.floor(r * 3.99); // 3 a 6
    const radio = this.radio;
    const margen = radio + 8;
    const bueno = this.rng.int(0, cuantos - 1);

    this.discos = [];
    for (let i = 0; i < cuantos; i++) {
      // Se colocan sin pisarse; si no cabe a la primera se insiste, porque dos
      // discos superpuestos al empezar hacen imposible saber cual se encendio.
      let x = 0;
      let y = 0;
      for (let intento = 0; intento < 60; intento++) {
        x = this.rng.range(margen, this.width - margen);
        y = this.rng.range(this.areaTop + margen, this.areaBottom - margen);
        if (this.discos.every((d) => Math.hypot(d.x - x, d.y - y) > radio * 2.3)) break;
      }
      const angulo = this.rng.range(0, Math.PI * 2);
      const rapidez = Math.min(this.width, this.areaHeight) * (0.26 + r * 0.34) * this.mut.speed;
      this.discos.push({
        x, y,
        vx: Math.cos(angulo) * rapidez,
        vy: Math.sin(angulo) * rapidez,
        bueno: i === bueno,
        brillo: 0,
        color: ACCENT,
      });
    }

    this.barajarS = 1.5 + r * 1.9;
    this.fase = 'marcando';
    this.faseT = 0;
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.faseT += dt;
    for (const d of this.discos) d.brillo = Math.max(0, d.brillo - dt * 2.2);

    switch (this.fase) {
      case 'marcando':
        if (this.faseT >= MARCAR_S) { this.fase = 'barajando'; this.faseT = 0; }
        break;
      case 'barajando':
        this.mover(dt);
        if (this.faseT >= this.barajarS) { this.fase = 'respondiendo'; this.faseT = 0; }
        break;
      case 'respondiendo':
        if (this.faseT >= RESPONDER_S) { this.fallar(null); break; }
        this.mirarToques();
        break;
      case 'revelando':
        if (this.faseT >= REVELAR_S) this.nuevaRonda();
        break;
    }
  }

  private mover(dt: number): void {
    const radio = this.radio;
    for (const d of this.discos) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < radio && d.vx < 0) { d.x = radio; d.vx *= -1; }
      if (d.x > this.width - radio && d.vx > 0) { d.x = this.width - radio; d.vx *= -1; }
      if (d.y < this.areaTop + radio && d.vy < 0) { d.y = this.areaTop + radio; d.vy *= -1; }
      if (d.y > this.areaBottom - radio && d.vy > 0) { d.y = this.areaBottom - radio; d.vy *= -1; }
    }

    // Los discos se empujan entre si en vez de atravesarse. Atravesarse seria
    // mas facil de programar y arruinaria el juego: el momento dificil es
    // exactamente cuando dos se juntan y se separan, y si uno pasa por encima
    // del otro sin tocarlo, la vista no llega a dudar nunca.
    for (let i = 0; i < this.discos.length; i++) {
      for (let j = i + 1; j < this.discos.length; j++) {
        const a = this.discos[i] as Disco;
        const b = this.discos[j] as Disco;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = radio * 2;
        if (d >= min || d === 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        const empuje = (min - d) / 2;
        a.x -= nx * empuje; a.y -= ny * empuje;
        b.x += nx * empuje; b.y += ny * empuje;
        const va = a.vx * nx + a.vy * ny;
        const vb = b.vx * nx + b.vy * ny;
        const delta = vb - va;
        a.vx += nx * delta; a.vy += ny * delta;
        b.vx -= nx * delta; b.vy -= ny * delta;
      }
    }
  }

  private mirarToques(): void {
    for (const tap of this.services.input.taps) {
      const x = this.mut.invertControls ? this.width - tap.x : tap.x;
      const y = this.mut.invertControls ? this.height - tap.y : tap.y;
      const radio = this.radio;
      let elegido = -1;
      let dist = Infinity;
      for (let i = 0; i < this.discos.length; i++) {
        const d = this.discos[i] as Disco;
        const dd = Math.hypot(d.x - x, d.y - y);
        if (dd < dist && dd <= radio * 1.3) { dist = dd; elegido = i; }
      }
      if (elegido < 0) continue;
      const d = this.discos[elegido] as Disco;
      if (d.bueno) this.acertar(d);
      else this.fallar(d);
      return;
    }
  }

  private acertar(d: Disco): void {
    const rapidez = 1 - Math.min(1, this.faseT / RESPONDER_S);
    const combo = this.bumpCombo();
    const multi = 1 + Math.min(10, combo) * 0.07;
    // Cuantos mas discos habia, mas vale: es la unica medida honesta de lo
    // dificil que era esa ronda concreta.
    const base = 45 + (this.discos.length - 3) * 42 + rapidez * 45;
    this.registerHit();
    this.aciertos++;
    this.acertoLaUltima = true;
    this.addScore(Math.round(base * multi), d.x, d.y);
    d.brillo = 1;
    d.color = BIEN;
    this.services.fx.burst(d.x, d.y, { count: 18, color: ACCENT, speed: 250, size: 4, shape: 'circulo' });
    this.services.fx.ring(d.x, d.y, this.radio * 2.2, ACCENT, 3);
    this.services.haptics.fire('medium');
    this.services.audio.play('hit');
    if (combo === 4) this.announce('NO LO PIERDES', 'good');
    this.fase = 'revelando';
    this.faseT = 0;
  }

  /** Fallo por tocar el que no era, o por quedarse sin decidir (d = null). */
  private fallar(d: Disco | null): void {
    this.registerMistake(40);
    this.acertoLaUltima = false;
    if (d) {
      d.brillo = 1;
      d.color = FALLO;
      this.services.fx.burst(d.x, d.y, { count: 10, color: FALLO, speed: 190, size: 4 });
    }
    const bueno = this.discos.find((x) => x.bueno);
    if (bueno) {
      bueno.brillo = 1;
      bueno.color = BIEN;
      this.services.fx.ring(bueno.x, bueno.y, this.radio * 2.4, BIEN, 3);
    }
    this.services.fx.shake(4);
    this.services.audio.play(d ? 'error' : 'miss');
    this.fase = 'revelando';
    this.faseT = 0;
  }

  protected draw(): void {
    const ctx = this.ctx;
    // Rejilla y no el fondo de circulos: el fondo de circulos estaba lleno de
    // aros del tamano de un disco y no habia forma de distinguir el tablero de
    // las piezas. En un juego que va de mirar, eso no es un detalle.
    backdropGrid(ctx, this.width, this.height, ACCENT, this.time * 6);
    const radio = this.radio;

    for (const d of this.discos) {
      const encendido =
        (this.fase === 'marcando' && d.bueno) ||
        (this.fase === 'revelando' && d.brillo > 0);
      const color = encendido ? d.color : hexToRgba('#cbd5e1', 0.72);

      ctx.save();
      if (encendido) {
        ctx.globalAlpha = 0.22;
        glowCircle(ctx, d.x, d.y, radio * 1.7, d.color, 30);
      }
      ctx.restore();

      // El aro es siempre igual y solo cambia el relleno: asi el disco bueno no
      // tiene NINGUNA marca de forma que delate cual era despues de apagarse.
      ctx.save();
      // Relleno claro y borde grueso. En la primera version eran azul marino
      // sobre fondo azul marino: en la captura no se veian los discos.
      ctx.fillStyle = encendido ? hexToRgba(d.color, 0.55) : hexToRgba('#94a3b8', 0.22);
      ctx.beginPath();
      ctx.arc(d.x, d.y, radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = encendido ? 5 : 3.4;
      if (encendido) { ctx.shadowColor = d.color; ctx.shadowBlur = 22; }
      ctx.stroke();
      // Un punto en el centro: da volumen y ayuda a seguirlo con la vista
      // cuando dos se cruzan, porque los centros no se solapan nunca.
      ctx.fillStyle = hexToRgba(encendido ? d.color : '#e2e8f0', encendido ? 0.95 : 0.5);
      ctx.beginPath();
      ctx.arc(d.x, d.y, radio * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.fase === 'marcando') {
      label(ctx, 'MIRA', this.width / 2, this.areaTop + 22, { size: 15, color: hexToRgba(ACCENT, 0.8) });
    } else if (this.fase === 'respondiendo') {
      label(ctx, 'CUAL ERA', this.width / 2, this.areaTop + 22, { size: 15, color: hexToRgba('#ffffff', 0.85) });
      const queda = Math.max(0, 1 - this.faseT / RESPONDER_S);
      const ancho = this.width * 0.5;
      ctx.fillStyle = hexToRgba(ACCENT, 0.2);
      ctx.fillRect((this.width - ancho) / 2, this.areaBottom - 10, ancho, 3);
      ctx.fillStyle = queda < 0.3 ? FALLO : ACCENT;
      ctx.fillRect((this.width - ancho) / 2, this.areaBottom - 10, ancho * queda, 3);
    } else if (this.fase === 'revelando') {
      label(ctx, this.acertoLaUltima ? 'ESE ERA' : 'ERA ESTE', this.width / 2, this.areaTop + 22, {
        size: 15,
        color: hexToRgba(this.acertoLaUltima ? BIEN : FALLO, 0.9),
      });
    }

    label(ctx, `${this.discos.length} DISCOS`, this.width / 2, this.areaBottom - 26, {
      size: 12,
      color: hexToRgba(ACCENT, 0.65),
    });
  }

  protected override metrics(): Record<string, number> {
    return { rondas: this.ronda, aciertos: this.aciertos, discos: this.discos.length };
  }

  debugInfo(): Record<string, unknown> {
    const bueno = this.discos.find((d) => d.bueno);
    return {
      game: 'trile',
      fase: this.fase,
      ronda: this.ronda,
      discos: this.discos.length,
      bueno: bueno ? { x: Math.round(bueno.x), y: Math.round(bueno.y) } : null,
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new TrileGame(services, config),
};
