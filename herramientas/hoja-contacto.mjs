import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const dir = process.argv[2];
const out = process.argv[3];
const cols = Number(process.argv[4] || 8);
const cell = Number(process.argv[5] || 200);

const files = fs.readdirSync(dir).filter(f => /\.png$/i.test(f)).sort();
const items = files.map((f, i) => ({
  i, name: f,
  data: "file:///" + path.join(dir, f).replace(/\\/g, "/").replace(/ /g, "%20").replace(/#/g, "%23"),
}));

const rows = Math.ceil(items.length / cols);
const bg = process.argv[6] || "#111";
const html = `<!doctype html><body style="margin:0;background:${bg};font:11px monospace;color:#0f0">
<div style="display:grid;grid-template-columns:repeat(${cols},${cell}px)">
${items.map(it => `<div style="width:${cell}px;height:${cell + 16}px;position:relative;border:1px solid #333">
<img src="${it.data}" style="width:${cell}px;height:${cell}px;object-fit:contain">
<div style="position:absolute;bottom:0;left:0;background:#000c;padding:1px 2px">${it.i}</div></div>`).join("")}
</div></body>`;

const tmp = path.join(path.dirname(out), "_hoja.html");
fs.writeFileSync(tmp, html);

const b = await chromium.launch({ args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: cols * (cell + 2) + 4, height: rows * (cell + 18) + 4 } });
await p.goto("file:///" + tmp.replace(/\\/g, "/"));
await p.waitForTimeout(1500);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log(items.map(it => it.i + "=" + it.name).join("\n"));
