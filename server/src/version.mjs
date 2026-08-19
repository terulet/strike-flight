/**
 * Identificador de build: que version se esta sirviendo AHORA MISMO.
 *
 * Se lee de `dist/build-id.txt`, que escribe vite al compilar. Es
 * deliberadamente eso y no `git rev-parse HEAD`, y la diferencia importa:
 * git dice en que commit esta el repositorio, no que codigo se esta
 * sirviendo. En cuanto alguien hace un pull sin reconstruir, las dos cosas
 * dejan de coincidir.
 *
 * Paso de verdad en el Mac Mini: tras un pull sin rebuild, el servidor
 * anunciaba un commit que no correspondia al bundle, el cliente comparaba
 * contra el suyo (incrustado al compilar), no cuadraban, y los moviles se
 * quedaban con el aviso de "hay una version nueva" de forma permanente:
 * al recargar recibian exactamente el mismo bundle y el aviso volvia a salir.
 *
 * Leyendo el fichero que genera la propia compilacion, el id solo cambia
 * cuando cambia lo que se sirve, que es lo unico que el cliente necesita
 * comparar. Sin `dist/` (modo desarrollo) se recurre a git, que ahi si vale.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cached = null;

function fromDist(distDir) {
  if (!distDir) return null;
  try {
    const value = readFileSync(join(distDir, 'build-id.txt'), 'utf8').trim();
    return value.length > 0 ? value : null;
  } catch {
    return null; // no hay build todavia: modo desarrollo
  }
}

function fromGit() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: new URL('../..', import.meta.url).pathname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function computeBuildId(distDir) {
  if (cached) return cached;
  cached = fromDist(distDir) ?? fromGit() ?? `dev-${Date.now().toString(36)}`;
  return cached;
}

/** Solo para tests: el valor se cachea a nivel de modulo. */
export function __resetBuildIdCache() {
  cached = null;
}
