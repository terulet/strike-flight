/**
 * LEVEL — geometría de la arena.
 *
 * El nivel se escribe como un mapa ASCII editable a mano (abajo). De ahí se
 * derivan tres cosas, cada una optimizada para su uso:
 *
 *   1. una rejilla de sólidos      → colisiones y raycast baratos (DDA)
 *   2. una lista de SEGMENTOS      → proyección de sombras de las luces
 *   3. puntos de interés           → spawns, munición, luces de emergencia
 *
 * Los segmentos se fusionan por tramos colineales: la arena pasa de ~600
 * aristas sueltas a unas pocas decenas, que es lo que hace viable calcular
 * polígonos de visibilidad a 60 fps en un móvil.
 *
 * Leyenda del mapa:
 *   #  muro     .  suelo     P  jugador
 *   E  enemigo  A  munición  L  luz de emergencia
 */

import { Config } from '../config/Config.js';

const MAP = [
  '##############################################',
  '##################.............###############',
  '##.........L.#####......E......###.........L.#',
  '##...........#####...#.....#.................#',
  '##..P.....A...............................E..#',
  '##......................#.............#..#...#',
  '##.............................###...........#',
  '##...........#####...#.....#...###...........#',
  '##...........#####..........E..###...........#',
  '#####..###########......L......#########..####',
  '#####..################..###############..####',
  '#####..################..###############..####',
  '#####.................................##..####',
  '#######.............###..........#....##..####',
  '#######.....##........................##..####',
  '#######.....##..............###...........####',
  '#######.....##...#..........###...........####',
  '#######.L..........A........###.......########',
  '#######.............###...............########',
  '#######...............................########',
  '###..####..####..#############...#############',
  '###..####..####..#############...#############',
  '###.A##########..###########........L........#',
  '###..##########..###########.................#',
  '###..##########..#######...........#.........#',
  '###..##########..######...A........#..#..#...#',
  '###...E........L...................E.........#',
  '###.....................####..............A..#',
  '############################.................#',
  '##############################################',
];

export class Level {
  constructor() {
    this.rows = MAP.length;
    this.cols = MAP[0].length;
    this.tile = Config.world.tileSize;
    this.width = this.cols * this.tile;
    this.height = this.rows * this.tile;

    for (const row of MAP) {
      if (row.length !== this.cols) {
        throw new Error(`Level: fila de ${row.length} celdas, se esperaban ${this.cols}`);
      }
    }

    /** @type {Uint8Array} 1 = sólido */
    this.solid = new Uint8Array(this.cols * this.rows);
    this.playerSpawn = { x: this.tile * 1.5, y: this.tile * 1.5 };
    this.enemySpawns = [];
    this.ammoSpawns = [];
    this.lampSpawns = [];

    this.#parse();
    this.segments = this.#buildSegments();
    this.corners = this.#buildCorners();
  }

  #parse() {
    const t = this.tile;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const ch = MAP[y][x];
        const cx = x * t + t / 2;
        const cy = y * t + t / 2;
        if (ch === '#') { this.solid[y * this.cols + x] = 1; continue; }
        switch (ch) {
          case 'P': this.playerSpawn = { x: cx, y: cy }; break;
          case 'E': this.enemySpawns.push({ x: cx, y: cy }); break;
          case 'A': this.ammoSpawns.push({ x: cx, y: cy }); break;
          case 'L': this.lampSpawns.push({ x: cx, y: cy }); break;
        }
      }
    }
  }

  /** ¿Es sólida la celda? Fuera del mapa cuenta como sólido. */
  isSolidCell(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return true;
    return this.solid[cy * this.cols + cx] === 1;
  }

  /** ¿Es sólido este punto del mundo? */
  isSolidAt(x, y) {
    return this.isSolidCell(Math.floor(x / this.tile), Math.floor(y / this.tile));
  }

  /**
   * Fusiona las aristas de las celdas sólidas en segmentos largos.
   * Una arista existe donde una celda sólida toca una no sólida.
   */
  #buildSegments() {
    const t = this.tile;
    const segs = [];

    // Aristas horizontales: frontera entre la fila y-1 y la fila y.
    for (let y = 0; y <= this.rows; y++) {
      let runStart = -1;
      for (let x = 0; x <= this.cols; x++) {
        const above = this.isSolidCell(x, y - 1);
        const below = this.isSolidCell(x, y);
        // Los bordes exteriores del mapa no generan arista (todo es sólido).
        const edge = x < this.cols && above !== below;
        if (edge && runStart < 0) runStart = x;
        if (!edge && runStart >= 0) {
          segs.push({ ax: runStart * t, ay: y * t, bx: x * t, by: y * t });
          runStart = -1;
        }
      }
    }

    // Aristas verticales: frontera entre la columna x-1 y la columna x.
    for (let x = 0; x <= this.cols; x++) {
      let runStart = -1;
      for (let y = 0; y <= this.rows; y++) {
        const left = this.isSolidCell(x - 1, y);
        const right = this.isSolidCell(x, y);
        const edge = y < this.rows && left !== right;
        if (edge && runStart < 0) runStart = y;
        if (!edge && runStart >= 0) {
          segs.push({ ax: x * t, ay: runStart * t, bx: x * t, by: y * t });
          runStart = -1;
        }
      }
    }

    // Cachear la caja envolvente evita recalcularla al cribar por radio de luz.
    for (const s of segs) {
      s.minX = Math.min(s.ax, s.bx); s.maxX = Math.max(s.ax, s.bx);
      s.minY = Math.min(s.ay, s.by); s.maxY = Math.max(s.ay, s.by);
    }
    return segs;
  }

  /** Extremos únicos de los segmentos: son los puntos a los que apuntan los rayos. */
  #buildCorners() {
    const seen = new Set();
    const pts = [];
    for (const s of this.segments) {
      for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) {
        const key = x * 100000 + y;
        if (seen.has(key)) continue;
        seen.add(key);
        pts.push({ x, y });
      }
    }
    return pts;
  }

  /**
   * Raycast sobre la rejilla (DDA de Amanatides & Woo).
   * Devuelve { hit, dist, nx, ny } — normal de la cara golpeada.
   * Se usa para proyectiles y línea de visión: O(celdas atravesadas).
   */
  raycast(ox, oy, dx, dy, maxDist) {
    const t = this.tile;
    let cx = Math.floor(ox / t);
    let cy = Math.floor(oy / t);

    if (this.isSolidCell(cx, cy)) return { hit: true, dist: 0, nx: -dx, ny: -dy };

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const invDx = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
    const invDy = dy !== 0 ? 1 / Math.abs(dy) : Infinity;

    // Distancia hasta el primer cruce de rejilla en cada eje.
    let tMaxX = dx !== 0
      ? ((dx > 0 ? (cx + 1) * t - ox : ox - cx * t)) * invDx
      : Infinity;
    let tMaxY = dy !== 0
      ? ((dy > 0 ? (cy + 1) * t - oy : oy - cy * t)) * invDy
      : Infinity;

    const tDeltaX = t * invDx;
    const tDeltaY = t * invDy;

    let dist = 0;
    // Techo de iteraciones: una arena entera en diagonal, nunca infinito.
    const maxSteps = (this.cols + this.rows) * 2;
    for (let i = 0; i < maxSteps; i++) {
      let nx = 0, ny = 0;
      if (tMaxX < tMaxY) {
        cx += stepX; dist = tMaxX; tMaxX += tDeltaX; nx = -stepX;
      } else {
        cy += stepY; dist = tMaxY; tMaxY += tDeltaY; ny = -stepY;
      }
      if (dist > maxDist) return { hit: false, dist: maxDist, nx: 0, ny: 0 };
      if (this.isSolidCell(cx, cy)) return { hit: true, dist, nx, ny };
    }
    return { hit: false, dist: maxDist, nx: 0, ny: 0 };
  }

  /** ¿Hay línea de visión libre entre dos puntos del mundo? */
  hasLineOfSight(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return true;
    const hit = this.raycast(ax, ay, dx / len, dy / len, len);
    return !hit.hit;
  }

  /**
   * Desplaza un círculo resolviendo eje por eje.
   * Separar los ejes es lo que hace que el jugador se deslice por las paredes
   * en vez de engancharse en las esquinas.
   */
  moveCircle(pos, vx, vy, radius, dt) {
    let nx = pos.x + vx * dt;
    if (this.#circleHits(nx, pos.y, radius)) { nx = pos.x; vx = 0; }
    let ny = pos.y + vy * dt;
    if (this.#circleHits(nx, ny, radius)) { ny = pos.y; vy = 0; }
    pos.x = nx; pos.y = ny;
    return { vx, vy };
  }

  #circleHits(x, y, r) {
    const t = this.tile;
    const x0 = Math.floor((x - r) / t), x1 = Math.floor((x + r) / t);
    const y0 = Math.floor((y - r) / t), y1 = Math.floor((y + r) / t);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!this.isSolidCell(cx, cy)) continue;
        // Punto de la celda más cercano al centro del círculo.
        const px = Math.max(cx * t, Math.min(x, cx * t + t));
        const py = Math.max(cy * t, Math.min(y, cy * t + t));
        const ddx = x - px, ddy = y - py;
        if (ddx * ddx + ddy * ddy < r * r) return true;
      }
    }
    return false;
  }


  /** Celdas de suelo cacheadas: la IA necesita puntos válidos a los que ir. */
  get floorCells() {
    if (!this._floorCells) {
      this._floorCells = [];
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!this.isSolidCell(x, y)) this._floorCells.push({ x, y });
        }
      }
    }
    return this._floorCells;
  }

  /** Punto de suelo al azar, opcionalmente cerca de (nx, ny). */
  randomFloorPoint(rng, nx = null, ny = null, radius = 0) {
    const t = this.tile;
    const cells = this.floorCells;
    // Muestreo por rechazo: barato y suficiente. Si no encuentra nada cerca,
    // devuelve cualquier celda antes que bloquear a la IA.
    const tries = radius > 0 ? 40 : 1;
    for (let i = 0; i < tries; i++) {
      const c = cells[Math.floor(rng.next() * cells.length)];
      const px = c.x * t + t / 2, py = c.y * t + t / 2;
      if (radius <= 0) return { x: px, y: py };
      if (Math.hypot(px - nx, py - ny) <= radius) return { x: px, y: py };
    }
    const c = cells[Math.floor(rng.next() * cells.length)];
    return { x: c.x * t + t / 2, y: c.y * t + t / 2 };
  }

  /** ¿Está libre este punto para un cuerpo de radio r? Usado al reubicar. */
  isFree(x, y, r) {
    return !this.isSolidAt(x, y)
      && !this.isSolidAt(x - r, y) && !this.isSolidAt(x + r, y)
      && !this.isSolidAt(x, y - r) && !this.isSolidAt(x, y + r);
  }

  /** Celdas de suelo alcanzables desde el spawn. Detecta zonas amuralladas. */
  reachableFrom(x, y) {
    const start = Math.floor(y / this.tile) * this.cols + Math.floor(x / this.tile);
    const seen = new Uint8Array(this.cols * this.rows);
    const queue = [start];
    seen[start] = 1;
    let count = 0;
    while (queue.length) {
      const i = queue.pop();
      count++;
      const cx = i % this.cols, cy = (i / this.cols) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jx = cx + ox, jy = cy + oy;
        if (this.isSolidCell(jx, jy)) continue;
        const j = jy * this.cols + jx;
        if (seen[j]) continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
    return { seen, count };
  }
}
