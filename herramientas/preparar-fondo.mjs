// ════════════════════════════════════════════════════════════
//  preparar-fondo.mjs — deja un fondo de mundo listo para art/fondos/
// ════════════════════════════════════════════════════════════
//
//    node herramientas/preparar-fondo.mjs "<master.png>" <id> [brilloObjetivo]
//
//  Copia el master a `art/fondos/<id>.png` y, si hace falta, lo BAJA de
//  brillo hasta el objetivo.
//
//  Por qué existe: el fondo es escenario, y la regla de art/fondos/
//  LEEME.txt es que lo más claro de la pantalla sea siempre la nave. Los
//  cuatro fondos que hay están entre 22 y 37 de luminancia media; un
//  master de hielo puede venir a 57, que es el doble, y sobre él las
//  balas enemigas —rosas, redondas y pequeñas— dejan de recortarse.
//
//  Se mide, no se decide a ojo: `medir-fondo.mjs` da la cifra antes y
//  después, y el ajuste es una multiplicación con un poco de curva para
//  no aplastar los negros a un gris plano.
// ════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [master, id, objetivoStr] = process.argv.slice(2);
if (!master || !id) {
  console.log('uso: node herramientas/preparar-fondo.mjs "<master.png>" <id> [brillo]');
  process.exit(1);
}
const objetivo = Number(objetivoStr || 0);

const b = await chromium.launch();
const p = await b.newPage();
await p.goto("about:blank");

const datos = "data:image/png;base64," + readFileSync(master).toString("base64");
const salida = await p.evaluate(async ({ datos, objetivo }) => {
  const img = new Image();
  img.src = datos;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);

  const medir = () => {
    const m = document.createElement("canvas");
    m.width = 120; m.height = 200;
    const mx = m.getContext("2d");
    mx.drawImage(c, 0, 0, 120, 200);
    const d = mx.getImageData(0, 0, 120, 200).data;
    let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++;
    }
    return s / n;
  };

  const antes = medir();
  let k = 1;
  if (objetivo > 0 && antes > objetivo) {
    // Multiplicación limpia, sin curva. La luminancia media escala igual
    // que el factor mientras no haya recorte, así que una sola pasada
    // deja el brillo donde se pide y —lo que importa— el CONTRASTE
    // relativo intacto: un fondo oscurecido con curva se vuelve plano y
    // deja de leerse como relieve.
    k = objetivo / antes;
    const d = x.getImageData(0, 0, c.width, c.height);
    const px = d.data;
    const tabla = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) tabla[v] = v * k;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = tabla[px[i]]; px[i + 1] = tabla[px[i + 1]]; px[i + 2] = tabla[px[i + 2]];
    }
    x.putImageData(d, 0, 0);
  }
  return { datos: c.toDataURL("image/png"), antes, despues: medir(), w: c.width, h: c.height };
}, { datos, objetivo });

await b.close();

const destino = join(RAIZ, "art", "fondos", id + ".png");
writeFileSync(destino, Buffer.from(salida.datos.split(",")[1], "base64"));
console.log("  ✓ " + id + ".png  " + salida.w + "x" + salida.h +
  "  brillo " + salida.antes.toFixed(1) + " → " + salida.despues.toFixed(1) +
  "  " + Math.round(readFileSync(destino).length / 1024) + " kB");
