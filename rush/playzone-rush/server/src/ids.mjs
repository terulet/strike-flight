import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Alfabeto sin caracteres que se confunden al dictar un codigo por WhatsApp:
 * fuera 0/O, 1/I/L, 5/S, 2/Z, 8/B.
 */
const ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY';

/** Codigo de invitacion de 4 caracteres, aleatorio (no secuencial). */
export function inviteCode(length = 4) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function newId() {
  return randomUUID();
}

/** Secreto por jugador: no es una cuenta, es "este movil es este jugador". */
export function newSecret() {
  return randomBytes(24).toString('hex');
}

export function isValidCode(code) {
  return typeof code === 'string' && /^[34679ACDEFGHJKMNPQRTUVWXY]{4,8}$/.test(code.toUpperCase());
}
