import { defineConfig } from 'vite';

// Base relativa: el build sale como ficheros estaticos que funcionan servidos
// por HTTP y tambien empaquetados dentro de un WKWebView (Capacitor) sin tocar
// una sola linea del juego.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 8192,
  },
});
