// ════════════════════════════════════════════════════════════
//  servir.mjs — abre el juego a la red local para probarlo en el iPad
// ════════════════════════════════════════════════════════════
//
//    node herramientas/servir.mjs
//    node herramientas/servir.mjs 8080     (otro puerto)
//
//  Hace falta HTTP y no vale abrir el archivo desde el iPad: con
//  file:// el navegador no deja leer los píxeles de una imagen de
//  disco, así que el recorte de fondo no funciona. Servido, sí.
//
//  El PC y el iPad tienen que estar en la MISMA red WiFi. La primera
//  vez, Windows preguntará si deja pasar Node por el cortafuegos: hay
//  que decir que sí para "Redes privadas".
//
//  No usa ninguna dependencia: Node y nada más.
// ════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUERTO = Number(process.argv[2]) || 8123;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
};

const servidor = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  // normalize() más la comprobación de prefijo: sin esto, una petición
  // con ../../ se llevaría cualquier archivo del disco.
  const destino = normalize(join(RAIZ, url === "/" ? "index.html" : url));
  if (!destino.startsWith(RAIZ)) { res.writeHead(403); res.end("no"); return; }

  try {
    const s = await stat(destino);
    if (s.isDirectory()) throw new Error("dir");
    const datos = await readFile(destino);
    res.writeHead(200, {
      "content-type": MIME[extname(destino).toLowerCase()] || "application/octet-stream",
      // Sin caché: probando en el iPad, lo último que se quiere es
      // recargar y seguir viendo la versión de hace media hora.
      "cache-control": "no-store",
    });
    res.end(datos);
  } catch (_) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404 " + url);
  }
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  const dirs = [];
  for (const lista of Object.values(networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === "IPv4" && !i.internal) dirs.push(i.address);
    }
  }
  const linea = "─".repeat(52);
  console.log("\n" + linea);
  console.log("  FLIGHT STRIKE — servidor de pruebas");
  console.log(linea);
  console.log("\n  En este PC:");
  console.log("    http://localhost:" + PUERTO);
  console.log("\n  En el iPad o el iPhone (misma WiFi):");
  for (const d of dirs) console.log("    http://" + d + ":" + PUERTO);
  console.log("\n  Con el panel de diagnóstico (audio, FPS, conteos):");
  for (const d of dirs) console.log("    http://" + d + ":" + PUERTO + "/?debug");
  console.log("\n" + linea);
  console.log("  Ctrl+C para parar.\n");
});
