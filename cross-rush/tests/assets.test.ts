import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardia contra el arte fantasma.
 *
 * La build llego a pesar 18 MB, y buena parte era arte que no se veia nunca:
 * sprites de obstaculo que se dejaron de dibujar cuando el relieve paso a
 * derivarse de la curva de colision, ambientacion atada a sectores que la
 * pista no tiene, y modelos de decoracion que la lista ofrecia pero el
 * reparto no llegaba a elegir jamas. Nada de eso da error: simplemente se
 * descarga y no se ve.
 *
 * Estos dos tests cierran las dos puertas que si se pueden cerrar de forma
 * estatica. Lo que no cubren -que un sprite importado y referenciado llegue
 * de verdad a pintarse en pantalla- se mide contando llamadas reales a
 * drawImage sobre una vuelta entera; ver docs/QA_VISUAL.md.
 */

const SPRITES_DIR = join(__dirname, '..', 'src', 'sprites');
const ASSETS_FILE = join(__dirname, '..', 'src', 'rendering', 'SpriteAssets.ts');
const assetsSource = readFileSync(ASSETS_FILE, 'utf-8');

function importedFiles(): string[] {
  return [...assetsSource.matchAll(/from '\.\.\/sprites\/([a-z0-9_]+\.webp)'/g)].map((match) => match[1]);
}

describe('arte que viaja en la build', () => {
  it('no hay ningun sprite en disco que nadie importe', () => {
    const onDisk = readdirSync(SPRITES_DIR).filter((name) => name.endsWith('.webp'));
    const imported = new Set(importedFiles());
    const orphans = onDisk.filter((name) => !imported.has(name));
    expect(orphans, `sprites en src/sprites que no importa nadie: ${orphans.join(', ')}`).toEqual([]);
  });

  it('todo sprite expuesto en SpriteImages se usa en algun sitio del juego', () => {
    const exposed = [...assetsSource.matchAll(/^ {2}([a-zA-Z0-9]+): loadImage\(/gm)].map((match) => match[1]);
    expect(exposed.length).toBeGreaterThan(20);

    const sources: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') && full !== ASSETS_FILE) sources.push(readFileSync(full, 'utf-8'));
      }
    };
    walk(join(__dirname, '..', 'src'));
    const allCode = sources.join('\n');

    const unused = exposed.filter((name) => !allCode.includes(`SpriteImages.${name}`));
    expect(unused, `expuestos en SpriteImages pero no usados: ${unused.join(', ')}`).toEqual([]);
  });
});
