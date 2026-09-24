/**
 * Convierte dist/ en UN solo HTML autocontenido (CSS, JS y fuentes dentro).
 * Sirve para compartirlo como un archivo o para publicarlo en claude.ai.
 *
 *   node scripts/single-file.mjs [dist] [salida.html] [--fragment]
 *
 * --fragment quita <html>/<head>/<body> (formato de los artifacts de claude.ai).
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const [distArg = 'dist', outArg = 'release/holeshot.html'] = args.filter((a) => !a.startsWith('--'));
const dist = path.resolve(distArg);
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
const jsSrc = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
if (!cssHref || !jsSrc) throw new Error('No encuentro el CSS o el JS en dist/index.html');

let css = fs.readFileSync(path.join(dist, cssHref[1]), 'utf8');
css = css.replace(/url\((?:\.\/)?([^)'"]+\.woff2)\)/g, (_, file) => {
  const buf = fs.readFileSync(path.join(dist, 'assets', path.basename(file)));
  return `url(data:font/woff2;base64,${buf.toString('base64')})`;
});
const js = fs.readFileSync(path.join(dist, jsSrc[1]), 'utf8');
if (/<\/script/i.test(js)) throw new Error('El JS contiene </script>');

const favicon = fs.existsSync(path.join(dist, 'favicon.svg')) ? fs.readFileSync(path.join(dist, 'favicon.svg')).toString('base64') : null;
let out = html
  .replace(cssHref[0], () => `<style>\n${css}\n</style>`)
  .replace(jsSrc[0], '')
  .replace('</body>', () => `<script type="module">\n${js}\n</script>\n</body>`);
if (favicon) out = out.replace(/href="\.\/favicon\.svg"/, `href="data:image/svg+xml;base64,${favicon}"`);

if (fragment) {
  const title = (out.match(/<title>.*?<\/title>/) || ['<title>HOLESHOT</title>'])[0];
  const style = out.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = out.match(/<body>([\s\S]*)<\/body>/)[1];
  out = `${title}\n<meta name="theme-color" content="#0d0f16" />\n${style}\n${body.trim()}\n`;
}
fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
fs.writeFileSync(outArg, out);
console.log(`${outArg}: ${(out.length / 1024).toFixed(0)} KB`);
