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
import { definition as semaforo } from './semaforo/index';
import { definition as stroop } from './stroop/index';
import { definition as teclas } from './teclas/index';
import { definition as clasifica } from './clasifica/index';
import { definition as diana } from './diana/index';
import { definition as corta } from './corta/index';
import { definition as grua } from './grua/index';
import { definition as apila } from './apila/index';
import { definition as cruza } from './cruza/index';
import { definition as salto } from './salto/index';
import { definition as tunel } from './tunel/index';
import { definition as corredor } from './corredor/index';
import { definition as serpiente } from './serpiente/index';
import { definition as invasores } from './invasores/index';
import { definition as ladrillos } from './ladrillos/index';
import { definition as asteroides } from './asteroides/index';
import { definition as simon } from './simon/index';

export function registerAllGames(): void {
  registerGame(pulse);
  registerGame(drift);
  registerGame(snap);
  registerGame(memory);
  registerGame(semaforo);
  registerGame(stroop);
  registerGame(teclas);
  registerGame(clasifica);
  registerGame(diana);
  registerGame(corta);
  registerGame(grua);
  registerGame(apila);
  registerGame(cruza);
  registerGame(salto);
  registerGame(tunel);
  registerGame(corredor);
  registerGame(serpiente);
  registerGame(invasores);
  registerGame(ladrillos);
  registerGame(asteroides);
  registerGame(simon);
}

export const GAME_IDS = [
  pulse.meta.id,
  drift.meta.id,
  snap.meta.id,
  memory.meta.id,
  semaforo.meta.id,
  stroop.meta.id,
  teclas.meta.id,
  clasifica.meta.id,
  diana.meta.id,
  corta.meta.id,
  grua.meta.id,
  apila.meta.id,
  cruza.meta.id,
  salto.meta.id,
  tunel.meta.id,
  corredor.meta.id,
  serpiente.meta.id,
  invasores.meta.id,
  ladrillos.meta.id,
  asteroides.meta.id,
  simon.meta.id,
];
