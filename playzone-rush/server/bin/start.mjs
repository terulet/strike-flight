#!/usr/bin/env node
/** Arranque del servidor de PLAYZONE RUSH. */
import { createPlayzoneServer } from '../src/server.mjs';
import { config } from '../src/config.mjs';

const instance = createPlayzoneServer();
const address = await instance.listen();
const port = typeof address === 'object' && address ? address.port : config.port;

console.log(`PLAYZONE RUSH · API en http://${config.host}:${port}`);
console.log(`  base de datos : ${config.dbPath}`);
console.log(`  zona horaria  : ${config.timezone} (dia competitivo: ${instance.api.serverDay()})`);
console.log(`  grupo maximo  : ${config.maxPlayersPerGroup} jugadores`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await instance.close();
    process.exit(0);
  });
}
