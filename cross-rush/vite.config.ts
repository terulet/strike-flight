import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5174,
  },
  preview: {
    host: true,
    port: 4174,
  },
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 8192,
  },
});
