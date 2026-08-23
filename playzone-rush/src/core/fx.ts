/**
 * Capa de "jugo": particulas, numeros flotantes, anillos de impacto, temblor
 * de pantalla y flashes. Vive fuera de los minijuegos para que ninguno tenga
 * que reimplementar el feedback, y para poder bajarlo entero con el ajuste de
 * movimiento reducido.
 */
/**
 * Forma de las particulas. No es adorno: es la parte mas barata de darle
 * caracter propio a cada juego sin tocar su mecanica. Un cuadrado se lee frio
 * y calculado, una chispa alargada se lee rapida, un circulo se lee blando.
 */
export type ParticleShape = 'cuadro' | 'circulo' | 'chispa';

export interface BurstOptions {
  count?: number;
  color?: string;
  speed?: number;
  size?: number;
  spread?: number;
  gravity?: number;
  life?: number;
  shape?: ParticleShape;
}

export interface FloatOptions {
  color?: string;
  size?: number;
  vy?: number;
  life?: number;
  bold?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  shape: ParticleShape;
}

/** Rastro que va dejando algo al moverse. Se dibuja como una linea que se apaga. */
interface Trail {
  puntos: { x: number; y: number }[];
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

/** Onda de choque: mas lenta y gorda que un anillo, para los momentos gordos. */
interface Shockwave {
  x: number;
  y: number;
  radius: number;
  target: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Floater {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
  bold: boolean;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  target: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export class FxSystem {
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  private trails: Trail[] = [];
  private shockwaves: Shockwave[] = [];
  private shakePower = 0;
  private shakeX = 0;
  private shakeY = 0;
  private flashAlpha = 0;
  private flashColor = '#ffffff';
  reducedMotion = false;
  /** Tope duro de particulas vivas: mantiene el coste estable en movil. */
  maxParticles = 320;

  burst(x: number, y: number, options: BurstOptions = {}): void {
    if (this.reducedMotion) return;
    const count = Math.round((options.count ?? 12) * 1);
    const speed = options.speed ?? 240;
    const spread = options.spread ?? Math.PI * 2;
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = base + (spread === Math.PI * 2 ? Math.random() * spread : (Math.random() - 0.5) * spread);
      const velocity = speed * (0.45 + Math.random() * 0.75);
      const life = (options.life ?? 0.5) * (0.6 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life,
        size: (options.size ?? 4) * (0.6 + Math.random() * 0.8),
        color: options.color ?? '#ffffff',
        gravity: options.gravity ?? 260,
        shape: options.shape ?? 'cuadro',
      });
    }
  }

  float(x: number, y: number, text: string, options: FloatOptions = {}): void {
    this.floaters.push({
      x,
      y,
      vy: options.vy ?? -70,
      life: options.life ?? 0.7,
      maxLife: options.life ?? 0.7,
      text,
      color: options.color ?? '#ffffff',
      size: options.size ?? 22,
      bold: options.bold ?? true,
    });
    // Tope bajo a proposito: mas de un punado de numeros a la vez deja de ser
    // feedback y pasa a ser ruido encima del juego.
    if (this.floaters.length > 8) this.floaters.shift();
  }

  ring(x: number, y: number, radius: number, color = '#ffffff', width = 3): void {
    if (this.reducedMotion) return;
    this.rings.push({ x, y, radius: radius * 0.35, target: radius, life: 0.4, maxLife: 0.4, color, width });
    if (this.rings.length > 24) this.rings.shift();
  }

  /**
   * Rastro de un movimiento. Se le pasan los puntos ya recorridos y los dibuja
   * apagandose. Util donde hay desplazamiento continuo (una nave, un dedo):
   * el movimiento se lee mucho mejor con estela que sin ella.
   */
  trail(puntos: { x: number; y: number }[], color = '#ffffff', width = 3, life = 0.45): void {
    if (this.reducedMotion || puntos.length < 2) return;
    // Se copia: quien llama suele reutilizar su propio array cada frame.
    this.trails.push({ puntos: puntos.map((p) => ({ x: p.x, y: p.y })), life, maxLife: life, color, width });
    if (this.trails.length > 12) this.trails.shift();
  }

  /**
   * Onda de choque: como ring() pero mas lenta, mas gorda y con mas recorrido.
   * Se reserva para lo que de verdad importa (un record, un adelantamiento);
   * si se usa para todo deja de significar nada.
   */
  shockwave(x: number, y: number, radius: number, color = '#ffffff'): void {
    if (this.reducedMotion) return;
    this.shockwaves.push({ x, y, radius: radius * 0.12, target: radius, life: 0.75, maxLife: 0.75, color });
    if (this.shockwaves.length > 6) this.shockwaves.shift();
  }

  shake(power: number): void {
    if (this.reducedMotion) return;
    this.shakePower = Math.min(1.6, this.shakePower + power);
  }

  flash(color = '#ffffff', alpha = 0.35): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, this.reducedMotion ? alpha * 0.4 : alpha);
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i] as Particle;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 1 - 1.6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i] as Floater;
      f.life -= dt;
      if (f.life <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 1 - 1.2 * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i] as Ring;
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      r.radius += (r.target - r.radius) * Math.min(1, dt * 12);
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i] as Trail;
      t.life -= dt;
      if (t.life <= 0) this.trails.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i] as Shockwave;
      w.life -= dt;
      if (w.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      // Se abre deprisa al principio y se va frenando: eso es lo que la hace
      // leerse como un golpe y no como un circulo creciendo sin mas.
      w.radius += (w.target - w.radius) * Math.min(1, dt * 4.5);
    }

    this.shakePower = Math.max(0, this.shakePower - dt * 3.2);
    const magnitude = this.shakePower * this.shakePower * 16;
    this.shakeX = (Math.random() * 2 - 1) * magnitude;
    this.shakeY = (Math.random() * 2 - 1) * magnitude;
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.6);
  }

  get shakeOffset(): { x: number; y: number } {
    return { x: this.shakeX, y: this.shakeY };
  }

  /** Particulas y anillos: van por debajo de la UI del minijuego. */
  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const w of this.shockwaves) {
      const t = w.life / w.maxLife;
      ctx.globalAlpha = Math.max(0, t) * 0.5;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2 + t * 9;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const tr of this.trails) {
      const t = tr.life / tr.maxLife;
      ctx.globalAlpha = Math.max(0, t) * 0.6;
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = tr.width * t;
      ctx.beginPath();
      tr.puntos.forEach((punto, i) => (i === 0 ? ctx.moveTo(punto.x, punto.y) : ctx.lineTo(punto.x, punto.y)));
      ctx.stroke();
    }

    for (const r of this.rings) {
      const t = r.life / r.maxLife;
      ctx.globalAlpha = Math.max(0, t) * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * t + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, Math.min(1, t));
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + t * 0.6);
      if (p.shape === 'circulo') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'chispa') {
        // Estirada en su direccion de vuelo: se lee como velocidad.
        const largo = Math.min(18, Math.hypot(p.vx, p.vy) * 0.045);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, s * 0.55);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.012 * largo, p.y - p.vy * 0.012 * largo);
        ctx.stroke();
      } else {
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.restore();
  }

  /** Numeros flotantes: siempre por encima de todo. */
  renderFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const t = f.life / f.maxLife;
      const scale = 1 + (1 - t) * 0.18;
      ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.6));
      ctx.fillStyle = f.color;
      ctx.font = `${f.bold ? '900' : '600'} ${Math.round(f.size * scale)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  renderFlash(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.flashAlpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.9, this.flashAlpha);
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  clear(): void {
    this.particles.length = 0;
    this.floaters.length = 0;
    this.rings.length = 0;
    this.trails.length = 0;
    this.shockwaves.length = 0;
    this.shakePower = 0;
    this.flashAlpha = 0;
  }
}
