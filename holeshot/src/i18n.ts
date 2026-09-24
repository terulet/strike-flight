/**
 * Idiomas: español e inglés.
 *
 * El texto de origen es el español: t(texto, {variables}) devuelve la
 * traducción si el idioma activo es el inglés (o el propio español). Una
 * prueba recorre el código y exige que cada llamada tenga su traducción.
 *
 * El idioma sale del navegador (español si es es-*, inglés en otro caso),
 * se puede cambiar desde el menú y se recuerda.
 */
import { EN } from './i18n.en';

export type Lang = 'es' | 'en';
const KEY = 'holeshot:lang';

function detect(): Lang {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  if (q === 'es' || q === 'en') return q;
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* sin almacenamiento */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let current: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function lang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* sin almacenamiento */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export function t(es: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? (EN[es] ?? es) : es;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Numero con separador de miles del idioma activo. */
export function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString(current === 'en' ? 'en-US' : 'es-ES');
}

/** Decimal con coma (es) o punto (en). */
export function fmtDecimal(n: number, digits = 1): string {
  const s = n.toFixed(digits);
  return current === 'en' ? s : s.replace('.', ',');
}

/** Ordinal corto: 1º / 1st. */
export function ordinal(n: number): string {
  if (current === 'es') return `${n}º`;
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

/** Textos fijos del HTML: `data-i18n` (texto) y `data-i18n-aria` (etiqueta accesible). */
export function applyStatic(): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n ?? '')));
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria ?? '')));
  document.title = t('HOLESHOT — Gira Mundial del Barro');
}
