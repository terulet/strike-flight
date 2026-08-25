/** Validacion de entrada. Nada entra a la base de datos sin pasar por aqui. */
import {
  ATTEMPT_LIMITS,
  CHALLENGE_IDS,
  GAME_LIMITS,
  MAX_SCORE_MULTIPLIER,
  challengeKind,
  config,
} from './config.mjs';
import { isValidDayKey } from './time.mjs';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export const bad = (code, message) => new ApiError(400, code, message);

/** Nombre de jugador: sin control, sin HTML, sin espacios raros, ni vacio ni gigante. */
export function cleanName(raw) {
  if (typeof raw !== 'string') throw bad('invalid_name', 'El nombre no es texto');
  const name = raw
    .replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, config.maxNameLength);
  if (name.length === 0) throw bad('invalid_name', 'El nombre no puede estar vacio');
  return name;
}

export function assertInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw bad('invalid_field', `${field} debe ser un entero`);
  }
  if (value < min || value > max) throw bad('invalid_field', `${field} fuera de rango`);
  return value;
}

export function assertString(value, field, { max = 64, pattern = null } = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw bad('invalid_field', `${field} invalido`);
  }
  if (pattern && !pattern.test(value)) throw bad('invalid_field', `${field} invalido`);
  return value;
}

/**
 * Comprueba un resultado de partida. El servidor no simula el juego: solo
 * descarta lo imposible (puntuacion desbocada, duracion absurda, juego que no
 * existe, dia que no es hoy).
 */
export function validateScorePayload(body, serverDay) {
  if (!body || typeof body !== 'object') throw bad('invalid_body');

  const attemptId = assertString(body.attemptId, 'attemptId', {
    max: 64,
    pattern: /^[A-Za-z0-9_-]{8,64}$/,
  });
  const gameId = assertString(body.gameId, 'gameId', { max: 24, pattern: /^[a-z0-9-]{2,24}$/ });
  const challengeId = assertString(body.challengeId, 'challengeId', { max: 24 });
  const day = assertString(body.day, 'day', { max: 10 });

  const limits = GAME_LIMITS[gameId];
  if (!limits) throw bad('unknown_game', `Juego desconocido: ${gameId}`);
  if (!CHALLENGE_IDS.includes(challengeId)) {
    throw bad('unknown_challenge', `Reto desconocido: ${challengeId}`);
  }
  if (!isValidDayKey(day)) throw bad('invalid_day', 'Formato de fecha invalido');
  if (day !== serverDay) throw bad('stale_day', 'Ese dia ya no esta abierto');

  const maxScore = Math.round(limits.maxScore * MAX_SCORE_MULTIPLIER);
  const score = assertInteger(body.score, 'score', { min: 0, max: maxScore });
  const durationMs = assertInteger(body.durationMs, 'durationMs', {
    min: limits.minDurationMs,
    max: limits.maxDurationMs,
  });
  const attemptsUsed = assertInteger(body.attemptsUsed ?? 0, 'attemptsUsed', {
    min: 0,
    max: ATTEMPT_LIMITS[challengeKind(challengeId)],
  });
  // Opcional y con un default seguro: un cliente viejo que todavia no manda
  // gameVersion no debe romperse por eso. 1000 de techo es solo para parar
  // un numero absurdo, no una prediccion de cuantas versiones habra.
  const gameVersion = assertInteger(body.gameVersion ?? 1, 'gameVersion', { min: 1, max: 1000 });
  const isTest = body.isTest === true;
  // DOBLE O NADA reenvia la marca ya apostada: no es un intento nuevo, es la
  // ultima palabra sobre uno que ya se jugo. Ver replaceScoreForBet en db.mjs.
  const isBet = body.isBet === true;

  let ghost = null;
  if (body.ghost != null) {
    if (typeof body.ghost !== 'object') throw bad('invalid_ghost');
    const trace = assertString(body.ghost.trace, 'ghost.trace', {
      max: config.maxGhostBytes,
      pattern: /^[A-Za-z0-9+/=]+$/,
    });
    ghost = {
      trace,
      durationMs: assertInteger(body.ghost.durationMs, 'ghost.durationMs', {
        min: 0,
        max: limits.maxDurationMs,
      }),
    };
  }

  return {
    attemptId,
    gameId,
    challengeId,
    day,
    score,
    durationMs,
    attemptsUsed,
    countsForRanking: body.countsForRanking !== false,
    gameVersion,
    isTest,
    isBet,
    ghost,
  };
}

export function attemptLimitFor(challengeId) {
  return ATTEMPT_LIMITS[challengeKind(challengeId)];
}
