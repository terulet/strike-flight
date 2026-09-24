/**
 * Empaqueta todo lo publicable en release/:
 *   holeshot-web.zip          la web publica (sube su contenido a cualquier hosting estatico)
 *   holeshot-crazygames.zip   el paquete para subir a CrazyGames (SDK v3 integrado)
 *   holeshot.html             el juego entero en un solo archivo
 *
 * Antes: npm run build && npm run build:crazygames (lo hace `npm run release`).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { zipDir } from './zip.mjs';

fs.mkdirSync('release', { recursive: true });
const web = zipDir('dist', 'release/holeshot-web.zip');
const cg = zipDir('dist-crazygames', 'release/holeshot-crazygames.zip');
execFileSync(process.execPath, ['scripts/single-file.mjs', 'dist', 'release/holeshot.html'], { stdio: 'inherit' });
for (const f of ['holeshot-web.zip', 'holeshot-crazygames.zip', 'holeshot.html']) {
  console.log(`release/${f}: ${(fs.statSync(`release/${f}`).size / 1024).toFixed(0)} KB`);
}
console.log(`(${web} archivos web, ${cg} archivos CrazyGames)`);
