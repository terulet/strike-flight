/**
 * Configuracion del servidor. Todo por variables de entorno, nada hardcodeado.
 * Los limites de puntuacion viven aqui porque el servidor no simula los juegos:
 * solo comprueba que lo que recibe es plausible.
 */
export const config = {
  port: Number.parseInt(process.env.PLAYZONE_PORT ?? '8787', 10),
  host: process.env.PLAYZONE_HOST ?? '0.0.0.0',
  dbPath: process.env.PLAYZONE_DB ?? new URL('../data/playzone.db', import.meta.url).pathname,
  /** Zona horaria del dia competitivo. El dia lo decide el servidor, no el movil. */
  timezone: process.env.PLAYZONE_TZ ?? 'Europe/Madrid',
  maxPlayersPerGroup: Number.parseInt(process.env.PLAYZONE_MAX_PLAYERS ?? '8', 10),
  maxNameLength: 16,
  /** Tamano maximo de cuerpo aceptado (los ghosts son lo mas grande). */
  maxBodyBytes: 64 * 1024,
  maxGhostBytes: 4096,
  /** Peticiones por minuto y jugador/IP. */
  rateLimitPerMinute: Number.parseInt(process.env.PLAYZONE_RATE_LIMIT ?? '240', 10),
  /** Se considera "en linea" si dio senales de vida en los ultimos N ms. */
  onlineWindowMs: 90_000,
  /** Origenes permitidos. '*' vale para la LAN de casa; en produccion, lista. */
  corsOrigin: process.env.PLAYZONE_CORS ?? '*',
};

/** Intentos permitidos por tipo de reto. Debe cuadrar con el cliente. */
export const ATTEMPT_LIMITS = {
  daily: 3,
  secret: 1,
  chaos: 1,
};

/**
 * Limites plausibles por juego. Calibrados con el bot de playtest (que juega
 * perfecto) mas un margen del 60%: no es un anti-cheat, es un cortafuegos
 * contra el que edita la peticion y se pone 99.999.999.
 */
export const GAME_LIMITS = {
  pulse: { maxScore: 14_000, minDurationMs: 800, maxDurationMs: 90_000 },
  drift: { maxScore: 14_000, minDurationMs: 800, maxDurationMs: 120_000 },
  snap: { maxScore: 10_000, minDurationMs: 800, maxDurationMs: 90_000 },
  memory: { maxScore: 14_000, minDurationMs: 800, maxDurationMs: 90_000 },
};

/** Multiplicador extra permitido cuando el reto lleva mutadores de puntos. */
export const MAX_SCORE_MULTIPLIER = 2.5;

export const CHALLENGE_IDS = ['c1', 'c2', 'c3', 'secret', 'chaos'];

export function challengeKind(challengeId) {
  if (challengeId === 'secret') return 'secret';
  if (challengeId === 'chaos') return 'chaos';
  return 'daily';
}
