// Mide brillo medio y p95 de unos PNG. El fondo tiene que ser MÁS OSCURO
// que la nave, y eso no se decide a ojo.
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const files = process.argv.slice(2);
const b = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const p = await b.newPage();
await p.goto("about:blank");
for (const f of files) {
  // Va como data: y no como file://. Una página en blanco no tiene
  // permiso para leer un archivo del disco, y el error que da —"the
  // source image cannot be decoded"— suena a PNG roto, que no lo está.
  const url = "data:image/png;base64," + fs.readFileSync(f).toString("base64");
  const r = await p.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 120; c.height = 200;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, 120, 200);
    const d = x.getImageData(0, 0, 120, 200).data;
    const lum = [];
    for (let i = 0; i < d.length; i += 4)
      lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    lum.sort((a, b) => a - b);
    const media = lum.reduce((a, v) => a + v, 0) / lum.length;
    return { media, p95: lum[Math.floor(lum.length * 0.95)], max: lum[lum.length - 1],
             w: img.naturalWidth, h: img.naturalHeight };
  }, url);
  console.log(path.basename(f).padEnd(44) +
    " medio " + r.media.toFixed(1).padStart(5) +
    " · p95 " + r.p95.toFixed(0).padStart(3) +
    " · máx " + r.max.toFixed(0).padStart(3) +
    " · " + r.w + "x" + r.h);
}
await b.close();
