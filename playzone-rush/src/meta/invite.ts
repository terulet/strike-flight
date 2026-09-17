/**
 * Enlace de invitacion.
 *
 * COMPARTIR mandaba solo el codigo del grupo: quien lo recibia tenia el "que"
 * pero no el "donde", y no habia forma de llegar al juego desde el mensaje.
 * Aqui se construye el enlace completo con el codigo dentro, para que abrirlo
 * sea entrar en el grupo.
 *
 * El origen sale de donde se este jugando (`location.origin`), asi que el
 * enlace es correcto tanto en el despliegue publico como en la Wi-Fi de casa,
 * sin dominios escritos a mano. `VITE_PUBLIC_URL` lo fija en la build cuando
 * la app tambien se abre por una direccion interna que los demas no alcanzan.
 */

/** Los codigos de grupo del servidor (server/src/ids.mjs), sin ambiguos. */
const CODE = /^[34679ACDEFGHJKMNPQRTUVWXY]{4,8}$/;

/** Parametro que lleva el codigo en el enlace: `...?g=RYXX`. */
export const INVITE_PARAM = 'g';

/** Deja el codigo como lo espera el servidor, o null si no puede serlo. */
export function normalizeGroupCode(raw: string | null | undefined): string | null {
  const code = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return CODE.test(code) ? code : null;
}

/** Enlace para invitar a un grupo. Devuelve null si el codigo no vale. */
export function buildInviteLink(
  code: string | null | undefined,
  origin: string,
  pathname = '/',
): string | null {
  const clean = normalizeGroupCode(code);
  if (!clean) return null;
  const base = origin.replace(/\/+$/, '');
  const path = pathname.replace(/index\.html$/, '');
  return `${base}${path.startsWith('/') ? path : '/' + path}?${INVITE_PARAM}=${clean}`;
}

/** Lee el codigo del `?g=` con el que se ha abierto la app. */
export function readInviteCode(search: string): string | null {
  const raw = new URLSearchParams(search).get(INVITE_PARAM);
  return raw === null ? null : normalizeGroupCode(raw);
}

/**
 * Un enlace que solo funciona dentro de esta red no sirve para invitar: si se
 * comparte, el amigo abre el mensaje y no carga nada. Se avisa antes.
 */
export function isLocalOrigin(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return true;
  }
  if (host === 'localhost' || host.endsWith('.local') || host === '127.0.0.1' || host === '::1') {
    return true;
  }
  // Rangos privados de IPv4: 10/8, 172.16/12 y 192.168/16.
  const ip = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!ip) return false;
  const a = Number(ip[1]);
  const b = Number(ip[2]);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Origen desde el que se invita: el de la build si se fijo, o el actual. */
export function publicOrigin(currentOrigin: string, configured?: string): string {
  const fixed = (configured ?? '').trim();
  return fixed ? fixed.replace(/\/+$/, '') : currentOrigin;
}

/** El mensaje que se envia. El enlace va aparte para que iOS lo enriquezca. */
export function inviteMessage(code: string): string {
  return `Te reto en PLAYZONE RUSH. Grupo ${code} — abre el enlace y ya estas dentro:`;
}
