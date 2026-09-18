import type { CapacitorConfig } from '@capacitor/cli';

/**
 * PLAYZONE RUSH como app nativa (TestFlight).
 *
 * El frontend viaja dentro del binario (`dist`), no se carga de un servidor:
 * asi Apple ve una app y no una pagina web envuelta, y abre sin cobertura.
 * Lo unico que sale a la red es la API, que sigue viviendo en el Mac Server.
 *
 * Ojo: aqui dentro `location.origin` es `capacitor://localhost`, que no le
 * sirve a nadie. Por eso la build nativa necesita `VITE_API_URL` (a donde
 * llamar) y `VITE_PUBLIC_URL` (que enlace compartir). Estan en `.env.ios`.
 */
const config: CapacitorConfig = {
  appId: 'com.boab.playzonerush',
  appName: 'PLAYZONE RUSH',
  webDir: 'dist',
  ios: {
    // El juego es oscuro: con fondo claro se ve un destello blanco al abrir.
    backgroundColor: '#07070f',
    contentInset: 'never',
  },
};

export default config;
