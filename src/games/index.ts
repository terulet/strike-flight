/**
 * Catalogo de minijuegos.
 *
 * Aqui es donde entra un juego nuevo. Un unico import + registerGame().
 * Cuando adaptemos un PLAYZONE 00X, su carpeta expondra su propio
 * `definition` y esta lista crecera en una linea.
 */
import { registerGame } from '../game/registry';
import { definition as pulse } from './pulse/index';
import { definition as drift } from './drift/index';
import { definition as snap } from './snap/index';

export function registerAllGames(): void {
  registerGame(pulse);
  registerGame(drift);
  registerGame(snap);
}

export const GAME_IDS = [pulse.meta.id, drift.meta.id, snap.meta.id];
