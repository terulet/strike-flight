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

export async function servidor() {
  const s = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const f = join(RAIZ, url === "/" ? "index.html" : url);
    try {
      const d = await readFile(f);
      res.writeHead(200, { "content-type": MIME[extname(f).toLowerCase()] || "application/octet-stream" });
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
  p.on("requestfailed", r => errores.push("404 " + r.url().replace(srv.url, "")));
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
  return p.evaluate(() => ({
    state, elapsed: +elapsed.toFixed(1), fps: +fps.toFixed(1),
    enemigos: enemies.length, balas: bullets.length, eBalas: eBullets.length,
    particulas: particles.length, efectos: efectos.length,
    boss: miniboss ? miniboss.tipo + " f" + miniboss.fase + " " + miniboss.hp + "/" + miniboss.hpMax : null,
    score, vidas: lives, calidad: calidadAuto,
  }));
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
