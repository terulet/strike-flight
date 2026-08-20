#!/usr/bin/env node
/**
 * Arranque del servidor de PLAYZONE RUSH.
 *
 * A partir de este milestone es tambien quien sirve el frontend en
 * produccion (si existe `dist/`, un solo proceso hace las dos cosas). Y
 * quien no debe morir en silencio: cualquier excepcion no capturada o
 * promesa rechazada se registra en la tabla de errores antes de reiniciar,
 * asi el panel de errores cuenta la historia completa de por que se cayo.
 */
import { existsSync } from 'node:fs';
import { createPlayzoneServer } from '../src/server.mjs';
import { config } from '../src/config.mjs';

const instance = createPlayzoneServer();

process.on('uncaughtException', (error) => {
  console.error('[playzone] excepcion no capturada:', error);
  try {
    instance.logServerError('uncaughtException', error);
  } finally {
    // Node ya no garantiza un estado valido tras esto. Salimos para que
    // pm2/launchd reinicien el proceso limpio en vez de seguir en zombi.
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[playzone] promesa rechazada sin capturar:', reason);
  instance.logServerError('unhandledRejection', reason);
});

const address = await instance.listen();
const port = typeof address === 'object' && address ? address.port : config.port;
const servingFrontend = existsSync(config.distDir);

console.log(`PLAYZONE RUSH · escuchando en http://${config.host}:${port}`);
console.log(`  build         : ${instance.buildId}`);
console.log(`  frontend      : ${servingFrontend ? `${config.distDir} (servido desde aqui)` : 'no encontrado — solo /api (modo dev)'}`);
console.log(`  base de datos : ${config.dbPath}`);
console.log(`  backups       : ${config.backupDir} (cada ${Math.round(config.backupIntervalMs / 3_600_000)} h, ultimos ${config.backupKeep})`);
console.log(`  zona horaria  : ${config.timezone} (dia competitivo: ${instance.api.serverDay()})`);
console.log(`  grupo maximo  : ${config.maxPlayersPerGroup} jugadores`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await instance.close();
    process.exit(0);
  });
}
