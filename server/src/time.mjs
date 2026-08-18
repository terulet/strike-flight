/**
 * El dia competitivo lo decide el servidor.
 *
 * Si lo decidiera cada movil, bastaria con cambiar el reloj del telefono para
 * empezar un dia nuevo con tres intentos frescos. Aqui se calcula siempre en
 * la zona configurada del grupo.
 */
export function dayKeyFor(timestampMs, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 'en-CA' formatea como YYYY-MM-DD, que es justo lo que guardamos.
  return formatter.format(new Date(timestampMs));
}

export function addDays(dayKey, delta) {
  const [y, m, d] = dayKey.split('-').map((v) => Number.parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function isValidDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
