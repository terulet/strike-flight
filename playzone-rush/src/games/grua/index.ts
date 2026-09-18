/**
 * GRUA - pescar en la cinta.
 *
 * La pinza va y viene arriba; abajo desfilan las piezas. Tocas y baja. Como
 * tarda en bajar, no vale apuntar a donde esta la pieza: hay que apuntar a
 * donde va a estar. Eso es todo el juego.
 *
 * Habilidad que mide: anticipacion. Calcular un adelanto, no reaccionar.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#fbbf24';
const BASURA = '#64748b';

interface Objeto {
  x: number;
  ancho: number;
  valor: number;
  color: string;
  basura: boolean;
  cogido: boolean;
}

type Pinza = 'buscando' | 'bajando' | 'subiendo';

export const META: GameMeta = {
  id: 'grua',
  name: 'GRUA',
  tagline: 'Suelta la pinza donde va a estar, no donde esta.',
  skill: 'precision',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca para bajar la pinza.',
    'Tarda en bajar: apunta por delante de la pieza.',
    'Las piezas GRISES son chatarra y restan.',
  ],
  icon: '🪝',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'swarm', 'chaos'],
};

class GruaGame extends BaseMiniGame {
  readonly meta = META;

  private objetos: Objeto[] = [];
  private pinzaX = 0;
  private dir = 1;
  private estado: Pinza = 'buscando';
  /** 0 arriba, 1 en la cinta. */
  private profundidad = 0;
  private agarrado: Objeto | null = null;
  private pescados = 0;
  private chatarra = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.objetos = [];
    this.pinzaX = this.width / 2;
    this.dir = 1;
    this.estado = 'buscando';
    this.profundidad = 0;
    this.agarrado = null;
    this.pescados = 0;
    this.chatarra = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(null);
    for (let i = 0; i < 3; i++) this.crear(this.width + i * this.width * 0.4);
  }

  private get cintaY(): number {
    return this.areaBottom - Math.max(40, this.areaHeight * 0.1);
  }

  private get velCinta(): number {
    return this.width * (0.2 + this.config.difficulty * 0.14 + this.progress * 0.2) * Math.max(0.5, this.mut.speed);
  }

  private get velPinza(): number {
    return this.width * 0.45 * Math.max(0.5, this.mut.speed);
  }

  private crear(x: number): void {
    const basura = this.rng.chance(0.3);
    const ancho = Math.min(this.width * 0.14, this.areaHeight * 0.09) * this.mut.sizeMultiplier;
    this.objetos.push({
      x,
      ancho,
      valor: basura ? -60 : this.rng.pick([80, 120, 200]),
      color: basura ? BASURA : (this.rng.pick(['#f472b6', '#38bdf8', '#4ade80', ACCENT]) as string),
      basura,
      cogido: false,
    });
  }

  protected tick(dt: number): void {
    this.time += dt;

    // La cinta corre siempre, tambien mientras la pinza baja.
    const vel = this.velCinta;
    for (let i = this.objetos.length - 1; i >= 0; i--) {
      const obj = this.objetos[i] as Objeto;
      if (obj.cogido) continue;
      obj.x -= vel * dt;
      if (obj.x + obj.ancho < -20) this.objetos.splice(i, 1);
    }
    const ultimo = this.objetos.reduce((max, o) => (o.cogido ? max : Math.max(max, o.x)), 0);
    const hueco = this.width * (0.34 - this.progress * 0.08) * (this.mut.extraHazards > 0 ? 0.7 : 1);
    if (ultimo < this.width - hueco) this.crear(this.width + 20);

    switch (this.estado) {
      case 'buscando': {
        this.pinzaX += this.dir * this.velPinza * dt;
        if (this.pinzaX < this.width * 0.06) {
          this.pinzaX = this.width * 0.06;
          this.dir = 1;
        } else if (this.pinzaX > this.width * 0.94) {
          this.pinzaX = this.width * 0.94;
          this.dir = -1;
        }
        if (this.tapPoints().length > 0 || this.services.input.keyTaps.length > 0) {
          this.estado = 'bajando';
          this.services.audio.play('select');
        }
        return;
      }
      case 'bajando': {
        this.profundidad += dt * 2.1 * Math.max(0.6, this.mut.speed);
        if (this.profundidad < 1) return;
        this.profundidad = 1;
        this.intentarAgarrar();
        this.estado = 'subiendo';
        return;
      }
      case 'subiendo': {
        this.profundidad -= dt * 2.6;
        if (this.agarrado) this.agarrado.x = this.pinzaX - this.agarrado.ancho / 2;
        if (this.profundidad > 0) return;
        this.profundidad = 0;
        this.cobrar();
        this.estado = 'buscando';
        return;
      }
    }
  }

  private intentarAgarrar(): void {
    const obj = this.objetos.find(
      (o) => !o.cogido && this.pinzaX >= o.x && this.pinzaX <= o.x + o.ancho,
    );
    if (!obj) {
      this.misses++;
      this.breakCombo();
      this.services.audio.play('miss');
      this.services.fx.ring(this.pinzaX, this.cintaY, 26, 'rgba(255,255,255,0.25)', 2);
      return;
    }
    obj.cogido = true;
    this.agarrado = obj;
    this.services.haptics.fire('tick');
  }

  private cobrar(): void {
    const obj = this.agarrado;
    this.agarrado = null;
    if (!obj) return;
    this.objetos = this.objetos.filter((o) => o !== obj);

    if (obj.basura) {
      this.chatarra++;
      this.misses++;
      this.breakCombo();
      this.addScore(obj.valor, this.pinzaX, this.areaTop + 40);
      this.announce('CHATARRA', 'bad');
      this.services.audio.play('error');
      this.services.fx.burst(this.pinzaX, this.areaTop + 50, { count: 10, color: BASURA, speed: 180, size: 4 });
      return;
    }

    this.pescados++;
    this.registerHit();
    const combo = this.bumpCombo();
    this.addScore(Math.round(obj.valor * (1 + Math.min(10, combo) * 0.08)), this.pinzaX, this.areaTop + 40);
    this.services.audio.play(obj.valor >= 200 ? 'record' : 'hit');
    this.services.haptics.fire('light');
    this.services.fx.burst(this.pinzaX, this.areaTop + 50, { count: 16, color: obj.color, speed: 240, size: 4 });
  }

  protected draw(): void {
    const ctx = this.ctx;
    const cinta = this.cintaY;
    const alturaCable = cinta - this.areaTop - 30;

    // Cinta transportadora, con marcas que se mueven para que se vea correr.
    ctx.save();
    ctx.fillStyle = hexToRgba('#ffffff', 0.06);
    ctx.fillRect(0, cinta, this.width, this.areaBottom - cinta);
    ctx.strokeStyle = hexToRgba('#ffffff', 0.14);
    ctx.lineWidth = 2;
    const paso = 34;
    const desfase = (this.time * this.velCinta) % paso;
    for (let x = -desfase; x < this.width; x += paso) {
      ctx.beginPath();
      ctx.moveTo(x, cinta);
      ctx.lineTo(x - 10, this.areaBottom);
      ctx.stroke();
    }
    ctx.restore();

    for (const obj of this.objetos) {
      if (obj.cogido) continue;
      const alto = obj.ancho * 0.8;
      ctx.fillStyle = obj.color;
      roundRect(ctx, obj.x, cinta - alto, obj.ancho, alto, 6);
      ctx.fill();
      if (obj.basura) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.x + 6, cinta - alto + 6);
        ctx.lineTo(obj.x + obj.ancho - 6, cinta - 6);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Rail, cable y pinza.
    const yPinza = this.areaTop + 30 + alturaCable * this.profundidad;
    ctx.save();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.areaTop + 20);
    ctx.lineTo(this.width, this.areaTop + 20);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba('#ffffff', 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.pinzaX, this.areaTop + 20);
    ctx.lineTo(this.pinzaX, yPinza);
    ctx.stroke();
    ctx.restore();

    if (this.agarrado) {
      const obj = this.agarrado;
      const alto = obj.ancho * 0.8;
      ctx.fillStyle = obj.color;
      roundRect(ctx, this.pinzaX - obj.ancho / 2, yPinza + 12, obj.ancho, alto, 6);
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const abierta = this.estado === 'buscando' ? 1 : 0.45;
    ctx.beginPath();
    ctx.moveTo(this.pinzaX, yPinza);
    ctx.lineTo(this.pinzaX - 14 * abierta, yPinza + 16);
    ctx.moveTo(this.pinzaX, yPinza);
    ctx.lineTo(this.pinzaX + 14 * abierta, yPinza + 16);
    ctx.stroke();
    ctx.restore();

    if (this.estado === 'buscando') {
      // Linea de puntería: sin ella no se entiende que la pinza cae recta.
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = ACCENT;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(this.pinzaX, yPinza + 18);
      ctx.lineTo(this.pinzaX, cinta);
      ctx.stroke();
      ctx.restore();
    }

    label(ctx, `${this.pescados} PESCADAS`, this.width / 2, this.areaTop + 8, {
      size: 13,
      color: hexToRgba('#ffffff', 0.45),
    });
  }

  protected override metrics(): Record<string, number> {
    return { pescados: this.pescados, chatarra: this.chatarra };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'grua', estado: this.estado, objetos: this.objetos.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new GruaGame(services, config),
};
