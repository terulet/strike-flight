// ════════════════════════════════════════════════════════════
//  qa.mjs — abre el juego de verdad, lo juega y hace capturas
// ════════════════════════════════════════════════════════════
//
//    node herramientas/qa.mjs artifacts/screenshots/lo-que-sea
//    node herramientas/qa.mjs <destino> --guion=herramientas/guiones/x.mjs
//
//  Levanta un servidor estático (hace falta HTTP: con file:// el navegador
//  no deja leer los píxeles de una imagen de disco), abre el juego en un
//  iPad y un iPhone simulados, y recoge TODO lo que dice la consola. Un
//  404 de un asset o una excepción salen en el informe, no en silencio.
// ════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MIME = { ".html":"text/html", ".js":"text/javascript", ".png":"image/png",
  ".json":"application/json", ".jpg":"image/jpeg", ".webp":"image/webp", ".txt":"text/plain" };

// Un error de sintaxis en index.html no da un mensaje útil: el navegador
// no ejecuta NADA y las pruebas fallan con "iniciarMision is not defined".
// Comprobarlo aquí ahorra el rato de buscar el fantasma.
export async function comprobarSintaxis() {
  const html = await readFile(join(RAIZ, "index.html"), "utf8");
  // El primer <script> ya no es el juego: es <script src="audio/muestras.js">.
  // Hay que quedarse con el bloque EN LÍNEA más largo, o esto pasaría a
  // comprobar la sintaxis de una cadena vacía y no avisaría de nada.
  const bloques = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).sort((a, b) => b.length - a.length);
  if (!bloques.length) return;
  try { new Function(bloques[0]); }
  catch (e) {
    console.error("✗ index.html no compila: " + e.message);
    process.exit(1);
  }
}

export async function servidor() {
  await comprobarSintaxis();
  const s = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const f = join(RAIZ, url === "/" ? "index.html" : url);
    try {
      const d = await readFile(f);
      const tipo = MIME[extname(f).toLowerCase()] || "application/octet-stream";
      // Rangos HTTP. Sin esto un <audio> NO PUEDE SALTAR: cualquier
      // cambio de posición se queda en 0, y la prueba de música daba
      // por roto lo que en un alojamiento de verdad funciona. Es
      // exactamente lo que sirve GitHub Pages, que es donde se publica.
      const rango = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (rango) {
        const ini = rango[1] ? +rango[1] : 0;
        const fin = rango[2] ? Math.min(+rango[2], d.length - 1) : d.length - 1;
        if (ini >= d.length || ini > fin) {
          res.writeHead(416, { "content-range": "bytes */" + d.length });
          return res.end();
        }
        res.writeHead(206, {
          "content-type": tipo,
          "content-range": "bytes " + ini + "-" + fin + "/" + d.length,
          "accept-ranges": "bytes",
          "content-length": fin - ini + 1,
        });
        return res.end(d.subarray(ini, fin + 1));
      }
      res.writeHead(200, { "content-type": tipo, "accept-ranges": "bytes", "content-length": d.length });
      res.end(d);
    } catch (_) { res.writeHead(404); res.end("no"); }
  });
  await new Promise(r => s.listen(0, "127.0.0.1", r));
  return { url: "http://127.0.0.1:" + s.address().port, cerrar: () => s.close() };
}

export async function cargarPlaywright() {
  for (const s of ["playwright", "playwright-core"]) {
    try { return await import(s); } catch (_) {}
  }
  console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

export const DISPOSITIVOS = {
  ipad:      { width: 820, height: 1180, dpr: 2 },
  iphone:    { width: 393, height: 852,  dpr: 3 },
  tablet:    { width: 800, height: 1280, dpr: 2 },
  escritorio:{ width: 1600, height: 900, dpr: 1 },
};

export async function abrir(pw, srv, disp, opts = {}) {
  const d = DISPOSITIVOS[disp] || DISPOSITIVOS.ipad;
  const ctx = await pw.navegador.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: d.dpr,
    hasTouch: true, isMobile: disp !== "escritorio",
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on("console", m => { if (m.type() === "error") errores.push("CONSOLE " + m.text()); });
  p.on("pageerror", e => errores.push("EXCEPCION " + e.message));
  // Una petición fallida NO es siempre un 404, y llamarlas todas así
  // mandaba a buscar archivos que estaban perfectamente. El caso normal
  // es `net::ERR_ABORTED`: cambiar de pista de música mientras la
  // anterior se está descargando aborta esa descarga, y eso es el
  // comportamiento correcto, no un fallo. Se informa del motivo REAL y
  // se ignoran los abortos de medios.
  p.on("requestfailed", r => {
    const motivo = (r.failure() && r.failure().errorText) || "?";
    const url = r.url().replace(srv.url, "");
    if (motivo.includes("ERR_ABORTED") && /\.(mp3|ogg|wav)$/i.test(url)) return;
    errores.push("PETICION " + motivo + " " + url);
  });
  await p.goto(srv.url + (opts.query || ""), { waitUntil: "load" });
  await p.waitForTimeout(opts.espera || 1200);
  p.errores = errores;
  return p;
}

// Adelanta el reloj del juego sin esperar en tiempo real. El bucle usa
// performance.now(), así que basta con dejar correr fotogramas reales:
// aquí se espera de verdad, pero se puede acelerar el guion de la misión.
export async function jugar(p, segundos) {
  await p.waitForTimeout(segundos * 1000);
}

// Salta a un momento concreto de la misión sin jugar hasta allí.
export async function saltarA(p, t) {
  await p.evaluate((t) => { elapsed = t; }, t);
  await p.waitForTimeout(300);
}

export async function captura(p, destino, nombre) {
  await mkdir(destino, { recursive: true });
  await p.screenshot({ path: join(destino, nombre + ".png") });
}

export async function estado(p) {
  return p.evaluate(() => {
    // Las partículas ya no son un array suelto: las lleva VFX, con su
    // presupuesto. Se informa del conteo y del tiempo de fotograma real,
    // que es lo que de verdad hace falta vigilar.
    const v = typeof VFX !== "undefined" ? VFX.metricas() : null;
    return {
      state, elapsed: +elapsed.toFixed(1), fps: +fps.toFixed(1),
      enemigos: enemies.length, balas: bullets.length, eBalas: eBullets.length,
      particulas: v ? v.parts : 0, maxPart: v ? v.maxParts : 0,
      ms: v ? +v.ms.toFixed(1) : 0, vfx: v ? v.calidad : "—",
      efectos: efectos.length,
      boss: miniboss ? miniboss.tipo + " f" + miniboss.fase + " " + miniboss.hp + "/" + miniboss.hpMax : null,
      score, vidas: lives, calidad: calidadAuto,
    };
  });
}

export async function informe(paginas, destino, titulo) {
  const errs = [];
  for (const [nombre, p] of Object.entries(paginas)) {
    for (const e of p.errores) errs.push(nombre + ": " + e);
  }
  const txt = "# " + titulo + "\n\n" + (errs.length ? errs.join("\n") : "Sin errores de consola ni 404.") + "\n";
  await mkdir(destino, { recursive: true });
  await writeFile(join(destino, "informe.txt"), txt);
  console.log(txt);
  return errs;
}
