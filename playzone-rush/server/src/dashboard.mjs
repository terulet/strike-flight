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
 *   6. Por juego: de los 12, cuales enganchan de verdad. Ver perGame() mas
 *      abajo para el porque y el como.
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
      'SELECT ts, player_id, day, type, game_id, value FROM events WHERE group_id = ? ORDER BY ts ASC',
    ),
    scores: db.prepare(`
      SELECT s.day, s.player_id, s.challenge_id, s.game_id, s.best_score, s.attempts_used, s.plays
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
      perGame: perGame(events, scores),
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

/* -------------------------------------------------------------------- */
/* Por juego: indice de enganche                                        */
/* -------------------------------------------------------------------- */

/**
 * De los 12 juegos, cuales enganchan de verdad -no cuales gustan mas en la
 * conversacion del grupo, sino cuales hacen que la gente pulse otra vez,
 * agote los tres intentos y mande la captura sin que nadie se lo pida.
 *
 * CINCO SENALES, cada una midiendo algo que las otras cuatro no miden:
 *
 *   revengeRate    -> "quiero otra" (el KPI estrella del proyecto, ahora por juego)
 *   shareRate      -> "esto me representa": de cada partida terminada, cuantas
 *                      producen un compartir de verdad. Es la senal MAS rara y
 *                      la MAS fuerte cuando aparece: nadie manda una imagen de
 *                      un juego que le da igual.
 *   exhaustedRate  -> "no me rindo hasta el tercer intento": compromiso dentro
 *                      de la propia partida, no solo entre partidas.
 *   completionRate -> lo contrario de "esto no engancha, lo dejo a medias".
 *   masteryRate    -> sigue superando su propia marca, no se ha estancado.
 *
 * MUESTRA MINIMA. Con menos de MIN_FINISHES partidas terminadas cualquier
 * ratio es ruido (un 100% de revancha con n=1 no dice nada). Esos juegos
 * salen en la lista con sus numeros crudos pero sin indice: `insufficient:
 * true` y `composite: null`, nunca un numero que aparente ser una conclusion.
 *
 * EL COMPUESTO. Las cinco tasas no viven en la misma escala -revengeRate
 * puede moverse en 20-70%, shareRate en 2-15%- asi que sumarlas a pelo
 * dejaria que la de rango mas ancho decidiera el orden por si sola. Se
 * normaliza cada una con min-max ENTRE LOS JUEGOS QUE SI TIENEN MUESTRA
 * (0 = el peor de los que hay, 1 = el mejor), y se combina con los pesos
 * declarados abajo. Con menos de dos juegos comparables no hay min-max que
 * valga -no se puede "comparar" con un solo punto- y todos salen sin indice.
 *
 * LOS PESOS SON UNA HIPOTESIS DE PARTIDA, NO UN VEREDICTO. Estan uno a uno en
 * COMPOSITE_WEIGHTS para poder discutirlos y recalcularlos sin tocar el resto
 * de la funcion. La tabla de metricas crudas se ensena siempre al lado del
 * indice: si el compuesto y los numeros de un juego no cuentan la misma
 * historia, se cree a los numeros.
 */
const MIN_FINISHES = 8;

const COMPOSITE_WEIGHTS = {
  // El KPI estrella del proyecto entero: "quiero otra" es la pregunta que mas
  // importa, y ya estaba elegida antes de que existiera este ranking.
  revengeRate: 0.3,
  // La senal social explicita. Pesa casi como la revancha porque, a
  // diferencia de las demas, no la puede fingir el propio diseno del juego:
  // un juego facil de rejugar no es necesariamente un juego del que dar
  // cuenta a los demas.
  shareRate: 0.25,
  // Compromiso dentro de la propia partida: gastarse los tres intentos en
  // vez de conformarse con el primero.
  exhaustedRate: 0.2,
  // Lo contrario de aburrir o frustrar a mitad de partida.
  completionRate: 0.15,
  // Sigue mejorando: la curva de habilidad no se ha aplanado.
  masteryRate: 0.1,
};

function perGame(events, scores) {
  const ids = new Set();
  for (const e of events) if (e.game_id) ids.add(e.game_id);
  for (const s of scores) if (s.game_id) ids.add(s.game_id);

  const raw = [...ids].map((gameId) => rawMetricsFor(gameId, events, scores));
  const withComposite = withCompositeScores(raw);
  withComposite.sort((a, b) => {
    if (a.composite === null && b.composite === null) return b.finishes - a.finishes;
    if (a.composite === null) return 1;
    if (b.composite === null) return -1;
    return b.composite - a.composite;
  });
  return { minSample: MIN_FINISHES, games: withComposite };
}

function rawMetricsFor(gameId, events, scores) {
  const ofType = (type) => events.filter((e) => e.type === type && e.game_id === gameId);
  const starts = ofType('game_start').length;
  const finishes = ofType('game_finish').length;
  const abandons = ofType('game_abandon').length;
  const revengeAvailable = ofType('revenge_available').length;
  const revengeClicked = ofType('revenge_clicked').length;
  const shareCompleted = ofType('share_completed').length;
  const scoreImproved = ofType('score_improved').length;

  // Solo los retos diarios (1-2-3 intentos): en secreto y CHAOS el limite es
  // 1, y "agotado" ahi seria siempre verdad -no mediria nada-.
  const dailyRows = scores.filter(
    (row) => row.game_id === gameId && DAILY_CHALLENGES.includes(row.challenge_id) && row.plays > 0,
  );
  const exhausted = dailyRows.filter((row) => row.attempts_used >= 3).length;

  return {
    gameId,
    starts,
    finishes,
    abandons,
    revengeAvailable,
    revengeClicked,
    revengeRate: revengeAvailable > 0 ? revengeClicked / revengeAvailable : null,
    shareCompleted,
    shareRate: finishes > 0 ? shareCompleted / finishes : null,
    dailyRows: dailyRows.length,
    exhausted,
    exhaustedRate: dailyRows.length > 0 ? exhausted / dailyRows.length : null,
    completionRate: starts > 0 ? finishes / starts : null,
    scoreImproved,
    masteryRate: finishes > 0 ? scoreImproved / finishes : null,
    insufficient: finishes < MIN_FINISHES,
  };
}

/** Min-max entre los juegos con muestra: 0 el peor, 1 el mejor de ESTE grupo. */
function normalized(games, key) {
  const values = games.filter((g) => !g.insufficient && g[key] !== null).map((g) => g[key]);
  const map = new Map();
  if (values.length === 0) return map;
  const min = Math.min(...values);
  const max = Math.max(...values);
  for (const g of games) {
    if (g.insufficient || g[key] === null) continue;
    map.set(g.gameId, max > min ? (g[key] - min) / (max - min) : 0.5);
  }
  return map;
}

function withCompositeScores(games) {
  const comparable = games.filter((g) => !g.insufficient);
  // Con menos de dos no hay "comparar" que valga: un solo juego seria a la
  // vez el primero y el ultimo.
  if (comparable.length < 2) return games.map((g) => ({ ...g, composite: null }));

  const norms = {};
  for (const key of Object.keys(COMPOSITE_WEIGHTS)) norms[key] = normalized(games, key);

  return games.map((g) => {
    if (g.insufficient) return { ...g, composite: null };
    let score = 0;
    let weightUsed = 0;
    for (const [key, weight] of Object.entries(COMPOSITE_WEIGHTS)) {
      const n = norms[key].get(g.gameId);
      if (n === undefined) continue; // esa metrica no tenia base para ESTE juego (p.ej. nunca fue ofrecida una revancha)
      score += n * weight;
      weightUsed += weight;
    }
    // Reescalado por el peso realmente usado: un juego sin ninguna revancha
    // OFRECIDA (nadie fue nunca por delante en ese juego) no debe verse
    // penalizado por una metrica que no tuvo ocasion de responder.
    const composite = weightUsed > 0 ? Math.round((score / weightUsed) * 100) : null;
    return { ...g, composite };
  });
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}
