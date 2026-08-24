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
import { definition as memory } from './memory/index';
import { definition as ritmo } from './ritmo/index';
import { definition as trazo } from './trazo/index';
import { definition as freno } from './freno/index';
import { definition as caza } from './caza/index';
import { definition as cuenta } from './cuenta/index';
import { definition as torre } from './torre/index';
import { definition as trile } from './trile/index';
import { definition as carga } from './carga/index';

export function registerAllGames(): void {
  registerGame(pulse);
  registerGame(drift);
  registerGame(snap);
  registerGame(memory);
  registerGame(ritmo);
  registerGame(trazo);
  registerGame(freno);
  registerGame(caza);
  registerGame(cuenta);
  registerGame(torre);
  registerGame(trile);
  registerGame(carga);
}

export const GAME_IDS = [
  pulse.meta.id, drift.meta.id, snap.meta.id, memory.meta.id, ritmo.meta.id, trazo.meta.id,
  freno.meta.id, caza.meta.id, cuenta.meta.id, torre.meta.id, trile.meta.id, carga.meta.id,
];
