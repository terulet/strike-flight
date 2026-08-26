import type { StructuralPiece } from '../entities/StructuralPiece';

export interface DebugState {
  showColliders: boolean;
  unlimitedShots: boolean;
  disableSlowMotion: boolean;
}

/**
 * Debug HUD (section 32). Toggle with the "D" key, or `?debug=1` to start visible.
 * Shows FPS/body counts/per-piece integrity and exposes cheat toggles Game reads each frame.
 */
export class DebugOverlay {
  el: HTMLDivElement;
  state: DebugState = { showColliders: false, unlimitedShots: false, disableSlowMotion: false };
  visible = false;

  constructor(private onForceRespawnRequest: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'cp-debug cp-hidden';
    this.el.innerHTML = `
      <h4>CRASHPOINT DEBUG</h4>
      <div data-el="perf"></div>
      <h4>TOGGLES</h4>
      <label><input type="checkbox" data-el="colliders"> mostrar colliders/joints</label>
      <label><input type="checkbox" data-el="unlimited"> disparos ilimitados</label>
      <label><input type="checkbox" data-el="noslowmo"> desactivar slow motion</label>
      <button class="cp-btn secondary" style="margin-top:6px;padding:6px 10px;font-size:11px;" data-el="respawn">RESET NIVEL</button>
      <h4>PIEZAS (id · material · integridad)</h4>
      <table data-el="pieces"></table>
    `;
    this.el.querySelector('[data-el="colliders"]')!.addEventListener('change', (e) => {
      this.state.showColliders = (e.target as HTMLInputElement).checked;
    });
    this.el.querySelector('[data-el="unlimited"]')!.addEventListener('change', (e) => {
      this.state.unlimitedShots = (e.target as HTMLInputElement).checked;
    });
    this.el.querySelector('[data-el="noslowmo"]')!.addEventListener('change', (e) => {
      this.state.disableSlowMotion = (e.target as HTMLInputElement).checked;
    });
    this.el.querySelector('[data-el="respawn"]')!.addEventListener('click', () => this.onForceRespawnRequest());
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle('cp-hidden', !this.visible);
  }

  update(info: { fps: number; pieces: Map<string, StructuralPiece>; projectileCount: number; bodyCount: number }): void {
    if (!this.visible) return;
    this.el.querySelector('[data-el="perf"]')!.innerHTML =
      `FPS: ${info.fps.toFixed(0)}<br/>Piezas: ${info.pieces.size} · Proyectiles activos: ${info.projectileCount}<br/>Cuerpos físicos: ${info.bodyCount}`;

    const rows = Array.from(info.pieces.values())
      .map((p) => `<tr><td>${p.id}</td><td>${p.material}</td><td>${p.broken ? 'ROTA' : Math.round(p.integrity * 100) + '%'}</td></tr>`)
      .join('');
    this.el.querySelector('[data-el="pieces"]')!.innerHTML = rows;
  }
}
