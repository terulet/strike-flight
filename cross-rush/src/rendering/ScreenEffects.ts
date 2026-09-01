/**
 * ScreenEffects.ts
 *
 * Efectos que ocurren en la PANTALLA y no en el mundo: el destello de un
 * truco, las lineas de velocidad del turbo y el oscurecimiento de los bordes
 * en un golpe fuerte.
 *
 * Van aparte del resto del render por una razon practica: no tienen posicion
 * en el mundo, no se mueven con la camara y no hay que interpolarlos con la
 * simulacion. Mezclarlos con las capas del mundo obligaria a colar
 * excepciones en todas ellas.
 *
 * Todos se dibujan en coordenadas de lienzo y se apagan solos. Se avanzan con
 * el tiempo REAL, no con el simulado: un destello tiene que durar lo mismo
 * aunque el juego este a camara lenta, porque si no, justo en el momento en
 * que mas se mira la pantalla, el efecto se queda pegado.
 */

/** Un destello de pantalla completa. */
interface Flash {
  age: number;
  life: number;
  color: string;
  peak: number;
}

export class ScreenEffects {
  private readonly flashes: Flash[] = [];
  /** 0..1: intensidad de las lineas de velocidad. */
  private speedLines = 0;
  /** 0..1: oscurecimiento de los bordes tras un golpe. */
  private impact = 0;

  /** `peak` 0..1 es la opacidad maxima del destello. */
  flash(color: string, peak = 0.5, life = 0.28): void {
    // Mas de tres a la vez no se distinguen y solo empastan la pantalla.
    if (this.flashes.length >= 3) this.flashes.shift();
    this.flashes.push({ age: 0, life, color, peak });
  }

  /** Golpe: oscurece los bordes y se relaja solo. */
  punch(strength: number): void {
    this.impact = Math.max(this.impact, Math.max(0, Math.min(1, strength)));
  }

  /** Objetivo de las lineas de velocidad, 0..1. Se persigue suavemente. */
  setSpeedLines(target: number): void {
    this.speedLines += (Math.max(0, Math.min(1, target)) - this.speedLines) * 0.12;
  }

  reset(): void {
    this.flashes.length = 0;
    this.speedLines = 0;
    this.impact = 0;
  }

  /** `dt` en segundos de tiempo REAL (ver cabecera). */
  update(dt: number): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].age += dt;
      if (this.flashes[i].age >= this.flashes[i].life) this.flashes.splice(i, 1);
    }
    this.impact = Math.max(0, this.impact - dt * 2.4);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas;

    // Lineas de velocidad: radiales desde el centro, solo en los bordes. El
    // centro se deja limpio a proposito, que es justo donde esta la moto.
    if (this.speedLines > 0.02) {
      const count = 26;
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const inner = Math.min(width, height) * 0.42;
      const outer = Math.hypot(width, height) * 0.6;
      ctx.save();
      ctx.globalAlpha = this.speedLines * 0.32;
      ctx.strokeStyle = 'rgba(255, 236, 214, 1)';
      ctx.lineCap = 'round';
      for (let i = 0; i < count; i++) {
        // Reparto fijo mas un sesgo: quedan mas densas a los lados que arriba
        // y abajo, que es por donde de verdad pasa el mundo.
        const angle = (i / count) * Math.PI * 2;
        const sideBias = 0.45 + 0.55 * Math.abs(Math.cos(angle));
        ctx.globalAlpha = this.speedLines * 0.3 * sideBias;
        ctx.lineWidth = 1 + sideBias * 2.4;
        const from = inner * (0.9 + 0.2 * ((i * 7) % 5) / 5);
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * from, centerY + Math.sin(angle) * from);
        ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Vinieta de impacto.
    if (this.impact > 0.01) {
      const gradient = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.3,
        width * 0.5,
        height * 0.5,
        Math.hypot(width, height) * 0.55,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(24, 8, 2, ${this.impact * 0.55})`);
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Destellos, al final: van por encima de todo lo demas.
    for (const flash of this.flashes) {
      const t = flash.age / flash.life;
      // Sube de golpe y se va: un destello que entra despacio no es un golpe.
      const alpha = flash.peak * Math.pow(1 - t, 2.2);
      if (alpha <= 0.004) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}
