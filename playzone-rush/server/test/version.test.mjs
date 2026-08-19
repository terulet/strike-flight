/**
 * El id del build tiene que ser el de LO QUE SE SIRVE, no el del repositorio.
 *
 * Reproduce el fallo que aparecio en produccion: un git pull sin reconstruir
 * dejaba al servidor anunciando un commit distinto al del bundle, y todos los
 * moviles se quedaban con el aviso de "hay una version nueva" permanente
 * porque al recargar recibian el mismo bundle de siempre.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { __resetBuildIdCache, computeBuildId } from '../src/version.mjs';

let dist;

beforeEach(() => {
  __resetBuildIdCache();
  dist = mkdtempSync(join(tmpdir(), 'playzone-dist-'));
});

afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
  __resetBuildIdCache();
});

describe('id del build', () => {
  it('lee el id que dejo la compilacion en dist/', () => {
    writeFileSync(join(dist, 'build-id.txt'), 'abc1234\n');
    expect(computeBuildId(dist)).toBe('abc1234');
  });

  it('un pull sin reconstruir NO cambia el id: manda el bundle, no git', () => {
    // dist/ se quedo en el build viejo; el repositorio ya va por otro commit.
    writeFileSync(join(dist, 'build-id.txt'), 'viejo99');
    const servido = computeBuildId(dist);

    // Aunque git diga otra cosa, el servidor tiene que seguir anunciando lo
    // que sirve de verdad: si no, el cliente ve una version nueva inexistente
    // y se queda pidiendo actualizar en bucle.
    expect(servido).toBe('viejo99');
    expect(servido).not.toMatch(/^dev-/);
  });

  it('sin dist/ (modo desarrollo) recurre a git y devuelve algo utilizable', () => {
    const id = computeBuildId(join(dist, 'no-existe'));
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('un build-id.txt vacio no se toma por bueno', () => {
    writeFileSync(join(dist, 'build-id.txt'), '   \n');
    const id = computeBuildId(dist);
    expect(id.trim().length).toBeGreaterThan(0);
  });
});
