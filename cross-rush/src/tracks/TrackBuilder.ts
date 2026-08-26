/**
 * TrackBuilder.ts
 *
 * Pequeno DSL imperativo para construir un heightfield de terreno a base de
 * tramos encadenados (llano, baches, rampas, huecos...). Cada metodo avanza
 * un cursor (x, y) y anade puntos de control al array que luego consume
 * `Terrain`. No hay nada especifico de "Canyon Run" aqui: son piezas
 * reutilizables para cualquier pista futura.
 */

import { TerrainPoint } from '../physics/Terrain';

const POINT_SPACING = 1.2; // metros entre puntos de control en tramos suaves

export interface SectorLabel {
  x: number;
  name: string;
}

export class TrackBuilder {
  readonly points: TerrainPoint[] = [];
  readonly labels: SectorLabel[] = [];
  private x = 0;
  private y = 0;

  constructor(startY = 0) {
    this.y = startY;
    this.points.push({ x: this.x, y: this.y });
  }

  get cursorX(): number {
    return this.x;
  }

  get cursorY(): number {
    return this.y;
  }

  mark(name: string): this {
    this.labels.push({ x: this.x, name });
    return this;
  }

  /** Tramo llano de longitud `length`. */
  flat(length: number): this {
    return this.slope(length, 0);
  }

  /** Rampa/pendiente lineal suave: sube o baja `deltaHeight` en `length` metros. */
  slope(length: number, deltaHeight: number): this {
    const steps = Math.max(1, Math.round(length / POINT_SPACING));
    const stepLen = length / steps;
    const stepHeight = deltaHeight / steps;
    for (let i = 0; i < steps; i++) {
      this.x += stepLen;
      this.y += stepHeight;
      this.points.push({ x: this.x, y: this.y });
    }
    return this;
  }

  /** Ondas periodicas (baches / whoops / seccion tecnica) alrededor de la altura actual. */
  waves(count: number, amplitude: number, wavelength: number): this {
    const baseY = this.y;
    const stepsPerWave = Math.max(2, Math.round(wavelength / POINT_SPACING));
    const stepLen = wavelength / stepsPerWave;
    for (let w = 0; w < count; w++) {
      for (let s = 1; s <= stepsPerWave; s++) {
        this.x += stepLen;
        const phase = (w + s / stepsPerWave) * Math.PI * 2;
        this.y = baseY + Math.sin(phase) * amplitude * 0.5 + amplitude * 0.5;
        this.points.push({ x: this.x, y: this.y });
      }
    }
    // Cerramos exactamente en baseY reescribiendo el ultimo punto (no
    // anadiendo uno nuevo), para no dejar dos puntos de control con la
    // misma x -> tangente infinita en el spline.
    this.y = baseY;
    this.points[this.points.length - 1] = { x: this.x, y: this.y };
    return this;
  }

  /** Rampa de despegue: sube con angulo creciente hasta `takeoffHeight` extra, en `length` metros. */
  rampUp(length: number, takeoffHeight: number): this {
    const steps = Math.max(3, Math.round(length / (POINT_SPACING * 0.6)));
    const stepLen = length / steps;
    const baseY = this.y;
    for (let i = 1; i <= steps; i++) {
      this.x += stepLen;
      const t = i / steps;
      // Curva de aceleracion (t^1.6) para que el borde de salida tenga mas angulo.
      this.y = baseY + Math.pow(t, 1.6) * takeoffHeight;
      this.points.push({ x: this.x, y: this.y });
    }
    return this;
  }

  /**
   * Hueco de aire tras una rampa: el terreno cae a un valle a `depth` por
   * debajo del despegue a lo largo de `length`, para que quien no salte lo
   * suficiente caiga con fuerza (riesgo real, no solo decorativo).
   */
  gapValley(length: number, depth: number): this {
    const baseY = this.y;
    const steps = Math.max(3, Math.round(length / POINT_SPACING));
    const stepLen = length / steps;
    for (let i = 1; i <= steps; i++) {
      this.x += stepLen;
      const t = i / steps;
      // Baja rapido y luego vuelve a subir hacia el final (zona de aterrizaje).
      const shape = Math.sin(Math.PI * t);
      this.y = baseY - shape * depth;
      this.points.push({ x: this.x, y: this.y });
    }
    this.y = baseY - 0; // vuelve a la altura de despegue aproximada al final
    this.points[this.points.length - 1] = { x: this.x, y: this.y };
    return this;
  }

  /** Rampa de aterrizaje: baja suavemente `dropHeight` para absorber un salto. */
  landingSlope(length: number, dropHeight: number): this {
    return this.slope(length, -Math.abs(dropHeight));
  }

  /** Peralte / curva: una elevacion ancha y suave (representa un banking en vista lateral). */
  bankedBump(length: number, height: number): this {
    const baseY = this.y;
    const steps = Math.max(4, Math.round(length / POINT_SPACING));
    const stepLen = length / steps;
    for (let i = 1; i <= steps; i++) {
      this.x += stepLen;
      const t = i / steps;
      this.y = baseY + Math.sin(Math.PI * t) * height;
      this.points.push({ x: this.x, y: this.y });
    }
    this.y = baseY;
    this.points[this.points.length - 1] = { x: this.x, y: this.y };
    return this;
  }

  build(): { points: TerrainPoint[]; labels: SectorLabel[]; endX: number; endY: number } {
    return { points: this.points, labels: this.labels, endX: this.x, endY: this.y };
  }
}
