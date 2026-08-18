import { defineConfig } from 'vite';

// Base relativa: el build sale como ficheros estaticos que funcionan servidos
// por HTTP y tambien empaquetados dentro de un WKWebView (Capacitor) sin tocar
// una sola linea del juego.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    // El movil habla siempre con un unico origen (el de Vite) y este reenvia
    // /api al backend: ni CORS ni configurar IPs en el telefono.
    proxy: {
      '/api': {
        target: process.env.PLAYZONE_API ?? 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.PLAYZONE_API ?? 'http://127.0.0.1:8787',
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
