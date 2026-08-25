/**
 * TORRE - el momento exacto de soltar.
 *
 * Un bloque va y viene por encima de la torre. Lo sueltas. Lo que sobresale se
 * cae, y el siguiente bloque ya solo es de ancho lo que quedo. Si clavas uno
 * encima del otro no pierdes nada, y cuatro clavadas seguidas te DEVUELVEN
 * ancho: por eso jugar bien no es solo aguantar, es recuperar terreno.
 *
 * Por que estaba haciendo falta en el catalogo:
 *
 * 1. Es el unico juego donde el error se ACUMULA. En todos los demas cada
 *    ronda empieza limpia; aqui el bloque numero 20 es estrecho por culpa de
 *    lo que hiciste en el 3. Eso cambia como se juega: obliga a ir con cuidado
 *    cuando aun no duele.
 * 2. Deja una imagen. Una torre alta y torcida se entiende en una foto sin que
 *    nadie explique nada, y este juego es de mandarse fotos.
 *
 * La camara sube sola para que la punta de la torre este siempre a la misma
 * altura de la pantalla: si no, a los diez bloques estarias jugando en el
 * borde de arriba.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#fb923c';
const FALLO = '#ff2d55';

/** Margen en pixeles para considerar que un bloque esta clavado. */
const CLAVADA = 4.5;
/** Clavadas seguidas que hacen falta para recuperar ancho. */
const CLAVADAS_PARA_CRECER = 4;

interface Bloque {
  x: number;
  ancho: number;
}

interface Cascote {
  x: number;
  y: number;
  w: number;
  vx: number;
  vy: number;
  giro: number;
  vida: number;
}

export const META: GameMeta = {
  id: 'torre',
  name: 'TORRE',
  tagline: 'Suelta el bloque justo encima. Lo que sobra, se cae.',
  skill: 'precision',
  defaultDurationMs: 40_000,
  instructions: [
    'El bloque va y viene. Tocalo para soltarlo.',
    'Lo que sobresalga se corta: el siguiente sera mas estrecho.',
    'Clavalo del todo y no pierdes nada. Cuatro seguidas y recuperas ancho.',
  ],
  icon: '▤',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['double', 'sprint', 'onelife', 'chaos', 'rush'],
};

class TorreGame extends BaseMiniGame {
  readonly meta = META;

  private pila: Bloque[] = [];
  private movil: Bloque = { x: 0, ancho: 0 };
  private direccion = 1;
  private velocidad = 0;
  private cascotes: Cascote[] = [];
  private camara = 0;
  private camaraObjetivo = 0;
  private clavadasSeguidas = 0;
  private clavadasTotal = 0;
  private altura = 0;
  private destello = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  private get altoBloque(): number {
    return Math.max(14, this.areaHeight * 0.055);
  }

  /** Donde se queda la punta de la torre en pantalla. */
  private get lineaDeJuego(): number {
    return this.areaTop + this.areaHeight * 0.42;
  }

  protected setup(): void {
    const anchoBase = Math.min(this.width * 0.56, 240) * this.mut.sizeMultiplier;
    this.pila = [{ x: (this.width - anchoBase) / 2, ancho: anchoBase }];
    this.cascotes = [];
    this.camara = 0;
    this.camaraObjetivo = 0;
    this.clavadasSeguidas = 0;
    this.clavadasTotal = 0;
    this.altura = 0;
    this.destello = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
    this.lanzarMovil();
  }

  private lanzarMovil(): void {
    const ultimo = this.pila[this.pila.length - 1] as Bloque;
    // Sale siempre por el lado contrario al que quedo el ultimo, para que no
    // haya un lado "facil" que se aprende y se repite.
    const porLaIzquierda = ultimo.x + ultimo.ancho / 2 > this.width / 2;
    this.movil = { x: porLaIzquierda ? -ultimo.ancho : this.width, ancho: ultimo.ancho };
    this.direccion = porLaIzquierda ? 1 : -1;

    const r = Math.min(1, this.altura / 22 + this.config.difficulty * 0.3 + this.progress * 0.25);
    this.velocidad = (this.width * (0.55 + r * 0.95)) * this.mut.speed;
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.destello = Math.max(0, this.destello - dt * 3);

    this.movil.x += this.direccion * this.velocidad * dt;
    // Rebota justo cuando el bloque entero ha entrado por el otro lado, no
    // antes: si rebotara en el borde visible, el sitio bueno estaria siempre
    // cerca del centro y el juego se resolveria mirando el centro.
    if (this.direccion > 0 && this.movil.x > this.width) this.direccion = -1;
    if (this.direccion < 0 && this.movil.x + this.movil.ancho < 0) this.direccion = 1;

    this.camara += (this.camaraObjetivo - this.camara) * Math.min(1, dt * 9);

    for (let i = this.cascotes.length - 1; i >= 0; i--) {
      const c = this.cascotes[i] as Cascote;
      c.vy += 1800 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.giro += dt * 4 * Math.sign(c.vx || 1);
      c.vida -= dt;
      if (c.vida <= 0) this.cascotes.splice(i, 1);
    }

    if (this.services.input.taps.length > 0 || this.services.input.keyTaps.length > 0) this.soltar();
  }

  private soltar(): void {
    const ultimo = this.pila[this.pila.length - 1] as Bloque;
    const desvio = this.movil.x - ultimo.x;
    const solape = Math.min(ultimo.x + ultimo.ancho, this.movil.x + this.movil.ancho) - Math.max(ultimo.x, this.movil.x);

    if (solape <= 0) {
      // Ni un pixel encima. Cuesta vida, pero el bloque vuelve con el mismo
      // ancho: perder vida Y ancho de golpe deja la partida sentenciada y lo
      // que queda de tiempo no sirve para nada.
      this.registerMistake(0);
      this.escombro(this.movil.x, this.movil.ancho, this.direccion);
      this.services.fx.shake(8);
      this.services.fx.flash(FALLO, 0.18);
      this.services.audio.play('error');
      this.clavadasSeguidas = 0;
      if (this._state === 'playing') this.lanzarMovil();
      return;
    }

    const clavado = Math.abs(desvio) <= CLAVADA;
    let nuevo: Bloque;

    if (clavado) {
      nuevo = { x: ultimo.x, ancho: ultimo.ancho };
      this.clavadasSeguidas++;
      this.clavadasTotal++;
      if (this.clavadasSeguidas >= CLAVADAS_PARA_CRECER) {
        // Premio gordo: se recupera ancho. Es lo que convierte la partida en
        // remontable en vez de en una cuesta abajo inevitable.
        this.clavadasSeguidas = 0;
        const tope = Math.min(this.width * 0.56, 240) * this.mut.sizeMultiplier;
        nuevo.ancho = Math.min(tope, nuevo.ancho + tope * 0.14);
        nuevo.x = Math.max(4, Math.min(this.width - nuevo.ancho - 4, nuevo.x - tope * 0.07));
        this.announce('RECUPERAS ANCHO', 'good');
        this.services.audio.play('unlock');
      }
    } else {
      this.clavadasSeguidas = 0;
      const x = Math.max(ultimo.x, this.movil.x);
      nuevo = { x, ancho: solape };
      const sobra = this.movil.ancho - solape;
      if (sobra > 1) {
        const ladoCortado = this.movil.x < ultimo.x ? this.movil.x : ultimo.x + ultimo.ancho;
        this.escombro(ladoCortado, sobra, this.movil.x < ultimo.x ? -1 : 1);
      }
    }

    this.pila.push(nuevo);
    this.altura++;
    // Lo que hay que subir para que la punta no pase de la linea de juego.
    this.camaraObjetivo = Math.max(0, this.pila.length * this.altoBloque - (this.areaBottom - this.lineaDeJuego));
    this.registerHit();

    const precision = 1 - Math.min(1, Math.abs(desvio) / Math.max(1, ultimo.ancho));
    const combo = clavado ? this.bumpCombo() : (this.breakCombo(), 0);
    const multi = 1 + Math.min(10, combo) * 0.08;
    const base = clavado ? 120 : 30 + precision * 55;
    const cy = this.lineaDeJuego;
    this.addScore(Math.round(base * multi), nuevo.x + nuevo.ancho / 2, cy);

    if (clavado) {
      this.destello = 1;
      this.services.fx.ring(nuevo.x + nuevo.ancho / 2, cy, nuevo.ancho * 0.8, ACCENT, 3);
      this.services.fx.burst(nuevo.x + nuevo.ancho / 2, cy, { count: 14, color: ACCENT, speed: 250, size: 4 });
      this.services.haptics.fire('medium');
      this.services.audio.play('score');
    } else {
      this.services.haptics.fire('light');
      this.services.audio.play('tap');
    }

    if (this.altura === 10) this.announce('DIEZ PISOS', 'good');
    if (this.altura === 20) this.announce('VEINTE PISOS', 'good');
    this.lanzarMovil();
  }

  private escombro(x: number, ancho: number, direccion: number): void {
    this.cascotes.push({
      x,
      y: this.lineaDeJuego,
      w: ancho,
      vx: direccion * this.rng.range(60, 160),
      vy: -this.rng.range(40, 140),
      giro: 0,
      vida: 1.1,
    });
  }

  /**
   * Y en pantalla del piso i (0 = el de abajo del todo).
   *
   * La torre se apoya en el SUELO y crece hacia arriba. La camara no se mueve
   * hasta que la punta llega a la linea de juego; a partir de ahi sube.
   * Antes la punta estaba clavada en la linea desde el primer bloque, asi que
   * los primeros pisos flotaban en mitad de la pantalla con medio movil vacio
   * por debajo y no se entendia que hubiera un suelo.
   */
  private pantallaY(i: number): number {
    return this.areaBottom - (i + 1) * this.altoBloque + this.camara;
  }

  protected draw(): void {
    const ctx = this.ctx;
    const h = this.altoBloque;

    // Fondo: un degradado que se aclara con la altura. Es el unico juego con
    // un "arriba" de verdad, y el fondo tiene que contarlo.
    const subida = Math.min(1, this.altura / 30);
    const g = ctx.createLinearGradient(0, this.areaTop, 0, this.height);
    g.addColorStop(0, `hsl(${222 - subida * 40} 46% ${8 + subida * 9}%)`);
    g.addColorStop(1, '#05070f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = hexToRgba(ACCENT, 0.1);
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const y = this.pantallaY(i * 3);
      if (y < this.areaTop || y > this.height) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();

    for (const c of this.cascotes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.vida);
      ctx.translate(c.x + c.w / 2, c.y);
      ctx.rotate(c.giro);
      ctx.fillStyle = hexToRgba(FALLO, 0.75);
      roundRect(ctx, -c.w / 2, -h / 2, c.w, h, 3);
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < this.pila.length; i++) {
      const b = this.pila[i] as Bloque;
      const y = this.pantallaY(i);
      if (y < this.areaTop - h * 2 || y > this.height + h) continue;
      // El tono sube con el piso: la torre se lee como un degradado y la foto
      // del final cuenta sola lo alto que llegaste.
      const tono = (26 + i * 7) % 360;
      const esUltimo = i === this.pila.length - 1;
      ctx.save();
      if (esUltimo && this.destello > 0) {
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 26 * this.destello;
      }
      ctx.fillStyle = `hsl(${tono} 88% ${52 + (i % 2) * 6}%)`;
      roundRect(ctx, b.x, y - h + 1, b.ancho, h - 2, 4);
      ctx.fill();
      ctx.restore();
    }

    // El movil, con su sombra sobre la punta de la torre: sin la sombra es muy
    // dificil calcular donde va a caer.
    const ultimo = this.pila[this.pila.length - 1] as Bloque;
    const yMovil = this.pantallaY(this.pila.length);
    ctx.save();
    // La proyeccion del movil sobre la punta: un contorno, no un relleno.
    // Relleno se leia como un bloque negro mas y parecia un fallo de dibujo.
    ctx.strokeStyle = hexToRgba('#ffffff', 0.5);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    roundRect(ctx, this.movil.x, this.pantallaY(this.pila.length - 1) - h + 2, this.movil.ancho, h - 2, 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `hsl(${(26 + this.pila.length * 7) % 360} 92% 62%)`;
    roundRect(ctx, this.movil.x, yMovil - h + 1, this.movil.ancho, h - 2, 4);
    ctx.fill();
    ctx.restore();

    // Guias verticales del ancho bueno: ensenan donde hay que apuntar sin
    // decirlo con palabras.
    ctx.save();
    ctx.strokeStyle = hexToRgba(ACCENT, 0.3);
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    for (const x of [ultimo.x, ultimo.x + ultimo.ancho]) {
      ctx.beginPath();
      ctx.moveTo(x, this.areaTop);
      ctx.lineTo(x, this.pantallaY(this.pila.length - 1));
      ctx.stroke();
    }
    ctx.restore();

    // El contador vive ARRIBA, no abajo. Antes la torre no llegaba al suelo y
    // el hueco de debajo estaba siempre libre; ahora que se apoya en el suelo
    // de verdad (ver pantallaY), el primer bloque ya ocupa ese sitio desde el
    // primer segundo de partida y el numero quedaba escrito encima del bloque.
    label(ctx, `${this.altura}`, this.width / 2, this.areaTop + 30, { size: 30, color: hexToRgba('#ffffff', 0.92) });
    label(ctx, 'PISOS', this.width / 2, this.areaTop + 54, { size: 11, color: hexToRgba(ACCENT, 0.8) });
  }

  protected override metrics(): Record<string, number> {
    return { pisos: this.altura, clavadas: this.clavadasTotal, ancho: Math.round(this.movil.ancho) };
  }

  debugInfo(): Record<string, unknown> {
    const ultimo = this.pila[this.pila.length - 1] as Bloque;
    return {
      game: 'torre',
      pisos: this.altura,
      movilX: Math.round(this.movil.x),
      objetivoX: Math.round(ultimo.x),
      ancho: Math.round(ultimo.ancho),
      direccion: this.direccion,
      velocidad: Math.round(this.velocidad),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new TorreGame(services, config),
};
