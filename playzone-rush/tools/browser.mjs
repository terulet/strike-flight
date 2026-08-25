/**
 * Arranque de Chromium compartido por todas las herramientas.
 *
 * El entorno de desarrollo original trae Chromium en una ruta fija, pero
 * cualquier otra maquina (un Mac con `npx playwright install chromium`, por
 * ejemplo) lo tiene en otro sitio. Fijar la ruta a pelo hacia que todas las
 * herramientas fallasen fuera de aquel entorno.
 *
 * Regla: si hay una ruta y existe, se usa; si no, se deja que Playwright
 * busque el navegador que tenga instalado. Asi funciona en los dos sitios sin
 * tener que exportar nada.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const FALLBACK = '/opt/pw-browsers/chromium';

export function launchBrowser(options = {}) {
  const candidate = process.env.PW_CHROME ?? FALLBACK;
  const launch = {
    args: ['--no-sandbox', '--use-gl=swiftshader'],
    ...options,
  };
  if (existsSync(candidate)) launch.executablePath = candidate;
  else if (process.env.PW_CHROME) {
    // Si alguien la ha puesto a mano y no existe, mejor decirlo que ignorarlo
    // en silencio y arrancar otro navegador distinto del que queria.
    console.warn(`[playzone] PW_CHROME apunta a algo que no existe: ${candidate}`);
    console.warn('[playzone] se usara el navegador que tenga instalado Playwright.');
  }
  return chromium.launch(launch);
}
