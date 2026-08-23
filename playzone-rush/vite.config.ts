import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';

/** Commit corto del momento de compilar. */
function buildId() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return `dev-${Date.now().toString(36)}`;
  }
}

const BUILD_ID = buildId();

/**
 * Deja el id del build dentro de dist/, junto al bundle que lo lleva dentro.
 *
 * El servidor lo lee de ahi en vez de preguntarle a git: si alguien hace un
 * git pull y no reconstruye, git ya dice otro commit pero lo que se esta
 * sirviendo sigue siendo el de antes. Preguntandole a git, el servidor
 * anunciaba una version que no existia y todos los moviles se quedaban con el
 * aviso de "hay una version nueva" para siempre, porque al recargar recibian
 * el mismo bundle. Este fichero solo cambia cuando cambia el bundle, que es
 * justo lo que hay que comparar.
 */
function emitBuildId(): Plugin {
  return {
    name: 'playzone-build-id',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-id.txt', source: BUILD_ID });
    },
  };
}

// Base relativa: el build sale como ficheros estaticos que funcionan servidos
// por HTTP y tambien empaquetados dentro de un WKWebView (Capacitor) sin tocar
// una sola linea del juego.
export default defineConfig({
  base: './',
  plugins: [emitBuildId()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: true,
    port: 5173,
    // El movil habla siempre con un unico origen (el de Vite) y este reenvia
    // /api al backend: ni CORS ni configurar IPs en el telefono.
    proxy: {
      '/api': {
        target: process.env.PLAYZONE_API ?? 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.PLAYZONE_API ?? 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 8192,
  },
});
