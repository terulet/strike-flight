/**
 * Metricas agregadas de la semana de alfa. SOLO LECTURA.
 *
 * Este modulo esta separado a proposito del panel de debug (que si puede
 * mover el dia, forzar mutadores y falsear partidas). Aqui no hay ni una
 * sentencia de escritura: solo prepara SELECTs. Si alguien intenta anadir un
 * INSERT/UPDATE mas adelante, cantara a la vista en el diff.
 *
 * Las metricas, por orden de importancia acordado:
 *   1. Retencion D1 / D3 / D7
 *   2. Revenge Rate (el KPI estrella)
 *   3. Intentos usados (1/3 vs 3/3)
 *   4. Reto diario completado
 *   5. Organic Reopen Rate: cuantas veces alguien vuelve a abrir PLAYZONE
 *      DESPUES de haber terminado su sesion del dia, con un rival habiendo
 *      jugado por en medio. Es decir: "a ver si ese cabron me ha pasado".
 *
 * Todo se calcula sobre datos reales del grupo. Cuando una metrica no tiene
 * suficiente base todavia, devuelve null y el denominador, en vez de un cero
 * que parezca un resultado.
 */
import { addDays } from './time.mjs';

/** Retrasos por debajo de esto no cuentan como "volver": es seguir navegando. */
const REOPEN_MIN_GAP_MS = 5 * 60_000;
const DAILY_CHALLENGES = ['c1', 'c2', 'c3'];

export function createDashboard(db) {
  // Solo SELECT. A proposito: este modulo no puede tocar resultados.
  const q = {
    players: db.prepare(
      'SELECT id, name, joined_at FROM players WHERE group_id = ? ORDER BY joined_at ASC',
    ),
    presence: db.prepare(`
      SELECT pr.day, pr.player_id, pr.seen_at FROM presence pr
      JOIN players p ON p.id = pr.player_id
      WHERE p.group_id = ? ORDER BY pr.day ASC
    `),
    events: db.prepare(
      'SELECT ts, player_id, day, type, value FROM events WHERE group_id = ? ORDER BY ts ASC',
    ),
    scores: db.prepare(`
      SELECT s.day, s.player_id, s.challenge_id, s.best_score, s.attempts_used, s.plays
      FROM scores s JOIN players p ON p.id = s.player_id
      WHERE p.group_id = ? ORDER BY s.day ASC
    `),
    attempts: db.prepare(`
      SELECT a.player_id, a.day, a.created_at FROM attempts a
      JOIN players p ON p.id = a.player_id
      WHERE p.group_id = ? ORDER BY a.created_at ASC
    `),
  };

  /**
   * @param groupId grupo del que se piden las metricas (nunca de otro)
   * @param today   dia competitivo actual segun el servidor
   */
  function metrics(groupId, today) {
    const players = q.players.all(groupId);
    const presence = q.presence.all(groupId);
    const events = q.events.all(groupId);
    const scores = q.scores.all(groupId);
    const attempts = q.attempts.all(groupId);

    return {
      generatedFor: today,
      players: players.length,
      days: new Set(presence.map((row) => row.day)).size,
      retention: retention(presence, today),
      revenge: revenge(events),
      attempts: attemptsUsed(scores),
      dailyCompletion: dailyCompletion(presence, scores),
      organicReopen: organicReopen(events, attempts, today),
      activity: activity(presence, events),
    };
  }

  return { metrics };
}

/* -------------------------------------------------------------------- */
/* Retencion                                                             */
/* -------------------------------------------------------------------- */

/**
 * Cohortes por primer dia visto. D1 = "volvio exactamente al dia siguiente",
 * no "volvio alguna vez": es mas duro, pero es lo que mide de verdad si el
 * habito diario engancha.
 *
 * Solo cuenta a quien ya ha tenido oportunidad de volver: si alguien entro
 * ayer, no puede estar en el denominador de D7. El "eligible" va en la
 * respuesta para que un 100% con base 1 no se lea como un exito.
 */
function retention(presence, today) {
  const daysByPlayer = new Map();
  for (const row of presence) {
    if (!daysByPlayer.has(row.player_id)) daysByPlayer.set(row.player_id, new Set());
    daysByPlayer.get(row.player_id).add(row.day);
  }

  const cohortDay = new Map();
  for (const [playerId, days] of daysByPlayer) {
    cohortDay.set(playerId, [...days].sort()[0]);
  }

  const measure = (offset) => {
    let eligible = 0;
    let returned = 0;
    for (const [playerId, first] of cohortDay) {
      const target = addDays(first, offset);
      if (target > today) continue; // todavia no ha podido volver
      eligible++;
      if (daysByPlayer.get(playerId).has(target)) returned++;
    }
    return { eligible, returned, rate: eligible > 0 ? returned / eligible : null };
  };

  return { d1: measure(1), d3: measure(3), d7: measure(7) };
}

/* -------------------------------------------------------------------- */
/* Revenge Rate                                                          */
/* -------------------------------------------------------------------- */

/** De cada revancha ofrecida, cuantas se pulsan. El KPI estrella. */
function revenge(events) {
  const available = events.filter((e) => e.type === 'revenge_available').length;
  const clicked = events.filter((e) => e.type === 'revenge_clicked').length;
  const overtaken = events.filter((e) => e.type === 'player_was_overtaken').length;
  return {
    available,
    clicked,
    rate: available > 0 ? clicked / available : null,
    timesOvertaken: overtaken,
    byLoss: lossBuckets(events),
  };
}

/** Por cuanto se pierde: sirve para ver a partir de que diferencia se rinde la gente. */
function lossBuckets(events) {
  const ranges = [
    { id: '0-100', min: 0, max: 100 },
    { id: '100-300', min: 100, max: 300 },
    { id: '300-1000', min: 300, max: 1000 },
    { id: '1000+', min: 1000, max: Infinity },
  ];
  return ranges.map((range) => {
    const inRange = (e) => typeof e.value === 'number' && e.value >= range.min && e.value < range.max;
    const available = events.filter((e) => e.type === 'revenge_available' && inRange(e)).length;
    const clicked = events.filter((e) => e.type === 'revenge_clicked' && inRange(e)).length;
    return { id: range.id, available, clicked, rate: available > 0 ? clicked / available : null };
  });
}

/* -------------------------------------------------------------------- */
/* Intentos                                                              */
/* -------------------------------------------------------------------- */

/**
 * 1/3 vs 3/3. Si casi todo el mundo se queda en 1, el sistema de tres
 * intentos no esta haciendo nada y sobra; si casi todos llegan a 3, es que
 * el pique aprieta.
 */
function attemptsUsed(scores) {
  const buckets = { 1: 0, 2: 0, 3: 0 };
  let total = 0;
  let used = 0;
  for (const row of scores) {
    if (!DAILY_CHALLENGES.includes(row.challenge_id)) continue;
    if (row.plays === 0) continue;
    const n = Math.min(3, Math.max(1, row.attempts_used));
    buckets[n]++;
    used += n;
    total++;
  }
  return {
    retosJugados: total,
    one: buckets[1],
    two: buckets[2],
    three: buckets[3],
    exhaustedRate: total > 0 ? buckets[3] / total : null,
    average: total > 0 ? used / total : null,
  };
}

/* -------------------------------------------------------------------- */
/* Reto diario completado                                                */
/* -------------------------------------------------------------------- */

/** De los dias en que alguien abrio, en cuantos termino los tres retos. */
function dailyCompletion(presence, scores) {
  const playedByPlayerDay = new Map();
  for (const row of scores) {
    if (!DAILY_CHALLENGES.includes(row.challenge_id) || row.plays === 0) continue;
    const key = `${row.day}|${row.player_id}`;
    if (!playedByPlayerDay.has(key)) playedByPlayerDay.set(key, new Set());
    playedByPlayerDay.get(key).add(row.challenge_id);
  }

  let active = 0;
  let completed = 0;
  let started = 0;
  for (const row of presence) {
    active++;
    const played = playedByPlayerDay.get(`${row.day}|${row.player_id}`);
    if (played && played.size > 0) started++;
    if (played && played.size === DAILY_CHALLENGES.length) completed++;
  }

  return {
    activeDays: active,
    startedDays: started,
    completedDays: completed,
    // De quien abre la app: cuantos llegan a jugar algo, y cuantos lo terminan.
    startRate: active > 0 ? started / active : null,
    completionRate: active > 0 ? completed / active : null,
  };
}

/* -------------------------------------------------------------------- */
/* Organic Reopen Rate                                                   */
/* -------------------------------------------------------------------- */

/**
 * La metrica que de verdad dice si esto es social o es un solitario con
 * marcador: cuanta gente vuelve a abrir la app DESPUES de haber terminado su
 * sesion del dia.
 *
 * Se cuenta como reapertura un app_open del mismo jugador y dia, al menos 5
 * minutos despues de su ultima partida (menos que eso es seguir navegando por
 * la app, no volver a ella).
 *
 * Y es ORGANICA si por en medio un rival ha jugado: eso es lo que mueve el
 * ranking y lo que hace volver a mirar. Se usa la tabla de intentos porque
 * ahi esta cada envio con su hora exacta, no solo el ultimo.
 *
 * Limite honesto: esto mide correlacion, no intencion. Nadie ha dicho por que
 * volvio. Lo que si separa es "volvio con el ranking movido" de "volvio sin
 * que nadie hubiera tocado nada", que es justo la distincion que interesa.
 */
function organicReopen(events, attempts, today) {
  const opensByPlayerDay = new Map();
  const lastPlayByPlayerDay = new Map();

  for (const event of events) {
    const key = `${event.day}|${event.player_id}`;
    if (event.type === 'app_open') {
      if (!opensByPlayerDay.has(key)) opensByPlayerDay.set(key, []);
      opensByPlayerDay.get(key).push(event.ts);
    }
    if (event.type === 'game_finish') {
      const previous = lastPlayByPlayerDay.get(key) ?? 0;
      if (event.ts > previous) lastPlayByPlayerDay.set(key, event.ts);
    }
  }

  const attemptsByDay = new Map();
  for (const row of attempts) {
    if (!attemptsByDay.has(row.day)) attemptsByDay.set(row.day, []);
    attemptsByDay.get(row.day).push(row);
  }

  let sessions = 0;
  let reopened = 0;
  let organic = 0;
  const gaps = [];

  for (const [key, finishedAt] of lastPlayByPlayerDay) {
    const [day, playerId] = key.split('|');
    // El dia de hoy sigue abierto: aun puede volver, no cuenta como cerrado.
    if (day === today) continue;
    sessions++;

    const opens = (opensByPlayerDay.get(key) ?? []).filter(
      (ts) => ts > finishedAt + REOPEN_MIN_GAP_MS,
    );
    if (opens.length === 0) continue;
    reopened++;

    const reopenAt = Math.min(...opens);
    gaps.push(reopenAt - finishedAt);

    const rivalPlayed = (attemptsByDay.get(day) ?? []).some(
      (row) => row.player_id !== playerId && row.created_at > finishedAt && row.created_at < reopenAt,
    );
    if (rivalPlayed) organic++;
  }

  return {
    // Sesiones diarias ya cerradas (dias anteriores a hoy) en las que alguien jugo.
    closedSessions: sessions,
    reopened,
    organic,
    reopenRate: sessions > 0 ? reopened / sessions : null,
    // La cifra que importa: de las sesiones terminadas, cuantas acaban con el
    // jugador volviendo porque el ranking se ha movido.
    organicReopenRate: sessions > 0 ? organic / sessions : null,
    medianGapMs: median(gaps),
  };
}

/* -------------------------------------------------------------------- */
/* Actividad                                                             */
/* -------------------------------------------------------------------- */

function activity(presence, events) {
  const byDay = new Map();
  for (const row of presence) {
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + 1);
  }
  const counts = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;

  return {
    activePlayersByDay: [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, players]) => ({ day, players })),
    eventCounts: counts,
  };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}
