/** Bucle de render con dt acotado y medidor de FPS. */
export type TickFn = (dt: number, now: number) => void;

const MAX_DT = 1 / 20; // si la pestana se va a segundo plano no queremos saltos

export class Ticker {
  private raf = 0;
  private last = 0;
  private running = false;
  private frames = 0;
  private fpsAccum = 0;
  private _fps = 0;

  constructor(private onTick: TickFn) {}

  get fps(): number {
    return this._fps;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const step = (now: number) => {
      if (!this.running) return;
      // Math.max(0, ...) y no solo Math.min(MAX_DT, ...): el primer fotograma
      // tras start() puede llegar con un timestamp de rAF ANTERIOR al
      // performance.now() que se guardo al arrancar -es el propio navegador
      // el que lo da asi, no un reloj mal leido- y sin el suelo, ese primer dt
      // sale negativo. Un dt negativo no se nota en casi nada porque los
      // contadores lo absorben, pero cualquiera que acumule con % (como
      // backdropRadial) puede acabar pidiendo un arco de radio negativo, y eso
      // no es un dibujo raro: es una excepcion sin capturar que para el bucle
      // de fotogramas entero. Se vio en la practica: PULSE y CUENTA lo tiraban
      // en jugadas normales, sin tocar nada del dispositivo.
      const dt = Math.max(0, Math.min(MAX_DT, (now - this.last) / 1000));
      this.last = now;
      this.frames++;
      this.fpsAccum += dt;
      if (this.fpsAccum >= 0.5) {
        this._fps = Math.round(this.frames / this.fpsAccum);
        this.frames = 0;
        this.fpsAccum = 0;
      }
      this.onTick(dt, now);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
