import { defineConfig, type Plugin } from 'vite';

/**
 * Modos de build:
 *   vite build                      -> dist/            web publica (sin anuncios)
 *   vite build --mode crazygames    -> dist-crazygames/ con el SDK v3 de CrazyGames
 */
function crazyGamesSdk(): Plugin {
  return {
    name: 'holeshot-crazygames-sdk',
    transformIndexHtml(html) {
      return html.replace('<head>', '<head>\n    <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>');
    },
  };
}

/**
 * Las tarjetas de vista previa (WhatsApp, X, Discord) necesitan direcciones
 * absolutas: con VITE_PUBLIC_URL=https://.../holeshot/ se completan al construir.
 */
function absoluteSocialUrls(publicUrl: string | undefined): Plugin {
  return {
    name: 'holeshot-social-urls',
    transformIndexHtml(html) {
      if (!publicUrl) return html;
      const base = publicUrl.endsWith('/') ? publicUrl : publicUrl + '/';
      return html.replace('content="./og.jpg"', `content="${base}og.jpg"`).replace('property="og:url" content="./"', `property="og:url" content="${base}"`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [absoluteSocialUrls(process.env.VITE_PUBLIC_URL), ...(mode === 'crazygames' ? [crazyGamesSdk()] : [])],
  define: mode === 'crazygames' ? { 'import.meta.env.VITE_PLATFORM': JSON.stringify('crazygames') } : {},
  build: {
    outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
}));
