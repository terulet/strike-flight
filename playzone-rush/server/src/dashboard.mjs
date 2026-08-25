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
      'SELECT ts, player_id, day, type, game_id, game_version, value, meta, is_test FROM events WHERE group_id = ? ORDER BY ts ASC',
    ),
    scores: db.prepare(`
      SELECT s.day, s.player_id, s.challenge_id, s.game_id, s.game_version, s.best_score, s.attempts_used, s.plays, s.is_test
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
    // is_test fuera desde aqui, no en cada funcion por separado: una partida
    // de ?debug (o de una herramienta de verificacion) no es una senal de
    // enganche humano, y ninguna metrica de este panel -ni las de mas
    // arriba, ni perGame()- debe verla nunca.
    const events = q.events.all(groupId).filter((e) => !e.is_test);
    const scores = q.scores.all(groupId).filter((s) => !s.is_test);
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
 * SEIS SENALES ENTRAN EN EL COMPUESTO, cada una midiendo algo que las otras
 * cinco no miden:
 *
 *   oneMoreRate    -> termina con otro intento libre: ¿pulsa el MISMO juego
 *                      otra vez enseguida? Es la pregunta mas directa de
 *                      todas -no depende de perder contra nadie, solo de si
 *                      la partida misma da ganas de repetirla-.
 *   revengeRate    -> "quiero otra" cuando alguien te ha pasado (el KPI
 *                      estrella original del proyecto, mas especifico que
 *                      oneMoreRate: solo cuenta cuando hay una persona de por
 *                      medio).
 *   shareRate      -> "esto me representa": de cada partida terminada,
 *                      cuantas producen un compartir de verdad. La senal MAS
 *                      rara y la MAS fuerte cuando aparece: nadie manda una
 *                      imagen de un juego que le da igual.
 *   exhaustedRate  -> "no me rindo hasta el tercer intento": compromiso
 *                      dentro de la propia partida, no solo entre partidas.
 *   completionRate -> lo contrario de "esto no engancha, lo dejo a medias".
 *   masteryRate    -> sigue superando su propia marca, no se ha estancado.
 *
 * Otras cinco se calculan y se ensenan pero NO entran en el compuesto,
 * porque miden cosas mas especificas o mas dificiles de comparar entre
 * juegos, y forzarlas dentro de un solo numero las diluye sin anadir nada
 * que exhaustedRate/completionRate no cubran ya de forma mas robusta:
 *
 *   abandonRate           -> el reverso exacto de completionRate. Se ensena
 *                             por separado porque "cuanto abandona" y
 *                             "cuanto completa" no son el mismo gesto para
 *                             quien lee el numero, aunque sean la misma resta.
 *   sessionContinuationRate-> terminar ESTE juego, ¿sigue jugando algo mas
 *                             ese dia o fue su ultima partida? Mide si el
 *                             juego empuja hacia PLAYZONE entero, no solo
 *                             hacia si mismo -por eso no sustituye a
 *                             oneMoreRate, que es mas estricto (el MISMO
 *                             juego, no cualquier otro)-.
 *   medianReplayMs         -> de las veces que hay One More, cuanto tarda.
 *                             400 ms y 2 minutos son ambos "otra vez", pero
 *                             no dicen lo mismo del impulso.
 *   closeLossReplayRate    -> de las revanchas ofrecidas por perder por
 *                             MARGEN PEQUENO (<=10% del rival, no puntos
 *                             absolutos: 100 puntos es todo un mundo en
 *                             TRAZO y nada en CUENTA), cuantas se pulsan.
 *   firstPickShare          -> de todos los "primeros juegos del dia"
 *                             observados en todo el grupo, que porcion fue
 *                             este. Mide deseo ANTES de jugar, no despues; no
 *                             es una tasa sobre "veces que estuvo disponible"
 *                             porque el servidor no guarda que planes
 *                             concretos vio cada uno, asi que es una cuota
 *                             relativa, no una probabilidad.
 *   longFrameRate50/100,      -> fraccion de fotogramas por encima de 50/100 ms
 *   worstFrameMs               y el peor fotograma visto, sumados de los cinco
 *                             numeros que cada partida manda al terminar
 *                             (GameHost, cliente). Sin esto, un juego con
 *                             microtirones en un movil concreto y un juego
 *                             simplemente poco divertido se ven IGUAL en el
 *                             resto de senales: One More bajo puede ser "el
 *                             diseno no engancha" o puede ser "no se puede
 *                             jugar bien en ese telefono", y son arreglos
 *                             distintos.
 *
 * MUESTRA MINIMA Y NIVELES DE CONFIANZA. Con pocas partidas terminadas
 * cualquier ratio es ruido: un 100% de revancha con n=1 no dice nada, y con
 * n=8 tampoco hay que enamorarse del resultado. `confidence` en vez de un
 * simple si/no:
 *   sinDatos    < 8    -> no entra en el compuesto, solo numeros crudos (n).
 *   muyBaja     8-24   -> el dashboard ya ensena un compuesto, pero es fragil.
 *   preliminar  25-49  -> empieza a decir algo, todavia con cautela.
 *   util        50-99  -> confianza razonable para decidir donde mirar.
 *   alta        100+   -> la que hace falta para un veredicto.
 * `insufficient` (booleano) se mantiene por compatibilidad con quien ya lo
 * usa (solo lo son sinDatos): no entrar en el compuesto solo pasa ahi.
 *
 * EL COMPUESTO. Las seis tasas no viven en la misma escala -revengeRate
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
 * historia, se cree a los numeros -el compuesto ordena, no concluye-.
 */
const MIN_FINISHES = 8;
const CONFIDENCE_TIERS = [
  { id: 'sinDatos', min: 0 },
  { id: 'muyBaja', min: 8 },
  { id: 'preliminar', min: 25 },
  { id: 'util', min: 50 },
  { id: 'alta', min: 100 },
];
/** "Por poco" para el close-loss replay: perder por este % del rival o menos. */
const CLOSE_MARGIN_PCT = 10;

const COMPOSITE_WEIGHTS = {
  // La pregunta mas directa de todas: hay otro intento, ¿lo usa? No depende
  // de que nadie te haya pasado, asi que mide enganche puro con la partida.
  oneMoreRate: 0.25,
  // El KPI estrella original del proyecto: mismo gesto que oneMoreRate pero
  // disparado por un rival, no por la propia partida. Pesa menos que antes
  // porque oneMoreRate ya cubre el enganche "en frio".
  revengeRate: 0.2,
  // La senal social explicita. No la puede fingir el propio diseno del
  // juego: uno facil de rejugar no es necesariamente uno del que presumir.
  shareRate: 0.2,
  // Compromiso dentro de la propia partida: gastarse los tres intentos en
  // vez de conformarse con el primero.
  exhaustedRate: 0.15,
  // Lo contrario de aburrir o frustrar a mitad de partida.
  completionRate: 0.1,
  // Sigue mejorando: la curva de habilidad no se ha aplanado.
  masteryRate: 0.1,
};

function confidenceOf(finishes) {
  let tier = CONFIDENCE_TIERS[0].id;
  for (const t of CONFIDENCE_TIERS) {
    if (finishes >= t.min) tier = t.id;
  }
  return tier;
}

function parseMeta(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Por (jugador, dia): de cada game_finish, el siguiente game_start que le
 * sigue ESE MISMO DIA (de cualquier juego). De aqui salen tres senales que
 * ningun conteo total puede dar, porque dependen del ORDEN, no del total.
 */
function sequencePairs(events) {
  const byPlayerDay = new Map();
  for (const event of events) {
    if (event.type !== 'game_finish' && event.type !== 'game_start') continue;
    const key = `${event.player_id}|${event.day}`;
    if (!byPlayerDay.has(key)) byPlayerDay.set(key, []);
    byPlayerDay.get(key).push(event);
  }

  const pairs = [];
  for (const list of byPlayerDay.values()) {
    list.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < list.length; i++) {
      const event = list[i];
      if (event.type !== 'game_finish') continue;
      const next = list.slice(i + 1).find((e) => e.type === 'game_start');
      const meta = parseMeta(event.meta);
      pairs.push({
        finishGameId: event.game_id,
        attemptsLeftAfter: typeof meta.attemptsLeftAfter === 'number' ? meta.attemptsLeftAfter : null,
        nextStartGameId: next ? next.game_id : null,
        deltaMs: next ? next.ts - event.ts : null,
      });
    }
  }
  return pairs;
}

/** El gameId del primer game_start "de verdad" (ni revancha) de cada (jugador, dia). */
function firstPicks(events) {
  const byPlayerDay = new Map();
  for (const event of events) {
    if (event.type !== 'game_start' || !event.game_id) continue;
    const meta = parseMeta(event.meta);
    if (!DAILY_CHALLENGES.includes(meta.challengeId)) continue; // secreto/CHAOS no son "el primero de tres a elegir"
    if (meta.revenge === true) continue; // una revancha no es una eleccion nueva
    const key = `${event.player_id}|${event.day}`;
    const current = byPlayerDay.get(key);
    if (!current || event.ts < current.ts) byPlayerDay.set(key, event);
  }
  const counts = new Map();
  for (const event of byPlayerDay.values()) counts.set(event.game_id, (counts.get(event.game_id) ?? 0) + 1);
  return counts;
}

function perGame(events, scores) {
  const ids = new Set();
  for (const e of events) if (e.game_id) ids.add(e.game_id);
  for (const s of scores) if (s.game_id) ids.add(s.game_id);

  const pairs = sequencePairs(events);
  const picks = firstPicks(events);
  const totalFirstPicks = [...picks.values()].reduce((a, b) => a + b, 0);

  const raw = [...ids].map((gameId) => rawMetricsFor(gameId, events, scores, pairs, picks, totalFirstPicks));
  const withComposite = withCompositeScores(raw);
  withComposite.sort((a, b) => {
    if (a.composite === null && b.composite === null) return b.finishes - a.finishes;
    if (a.composite === null) return 1;
    if (b.composite === null) return -1;
    return b.composite - a.composite;
  });
  return { minSample: MIN_FINISHES, closeMarginPct: CLOSE_MARGIN_PCT, games: withComposite };
}

function rawMetricsFor(gameId, events, scores, pairs, picks, totalFirstPicks) {
  const ofType = (type) => events.filter((e) => e.type === type && e.game_id === gameId);
  const starts = ofType('game_start').length;
  const finishEvents = ofType('game_finish');
  const finishes = finishEvents.length;
  const abandons = ofType('game_abandon').length;
  const revengeAvailable = ofType('revenge_available');
  const revengeClicked = ofType('revenge_clicked');
  const shareCompleted = ofType('share_completed').length;
  const scoreImproved = ofType('score_improved').length;

  // Solo los retos diarios (1-2-3 intentos): en secreto y CHAOS el limite es
  // 1, y "agotado" ahi seria siempre verdad -no mediria nada-.
  const dailyRows = scores.filter(
    (row) => row.game_id === gameId && DAILY_CHALLENGES.includes(row.challenge_id) && row.plays > 0,
  );
  const exhausted = dailyRows.filter((row) => row.attempts_used >= 3).length;

  const gamePairs = pairs.filter((p) => p.finishGameId === gameId);
  const withAttemptsLeft = gamePairs.filter((p) => p.attemptsLeftAfter !== null && p.attemptsLeftAfter > 0);
  const oneMore = withAttemptsLeft.filter((p) => p.nextStartGameId === gameId);
  const continued = gamePairs.filter((p) => p.nextStartGameId !== null);
  const replayDeltas = oneMore.map((p) => p.deltaMs).filter((d) => d !== null);

  const closeAvailable = revengeAvailable.filter((e) => (parseMeta(e.meta).marginPct ?? Infinity) <= CLOSE_MARGIN_PCT);
  const closeClicked = revengeClicked.filter((e) => (parseMeta(e.meta).marginPct ?? Infinity) <= CLOSE_MARGIN_PCT);

  const perf = performanceFor(finishEvents);
  const finishesCount = finishes;
  return {
    gameId,
    starts,
    finishes: finishesCount,
    abandons,
    abandonRate: starts > 0 ? abandons / starts : null,
    revengeAvailable: revengeAvailable.length,
    revengeClicked: revengeClicked.length,
    revengeRate: revengeAvailable.length > 0 ? revengeClicked.length / revengeAvailable.length : null,
    shareCompleted,
    shareRate: finishesCount > 0 ? shareCompleted / finishesCount : null,
    dailyRows: dailyRows.length,
    exhausted,
    exhaustedRate: dailyRows.length > 0 ? exhausted / dailyRows.length : null,
    completionRate: starts > 0 ? finishesCount / starts : null,
    scoreImproved,
    masteryRate: finishesCount > 0 ? scoreImproved / finishesCount : null,
    // One More: de las veces que termino CON otro intento libre, cuantas
    // volvieron a pulsar este mismo juego de inmediato.
    oneMoreOpportunities: withAttemptsLeft.length,
    oneMoreCount: oneMore.length,
    oneMoreRate: withAttemptsLeft.length > 0 ? oneMore.length / withAttemptsLeft.length : null,
    medianReplayMs: median(replayDeltas),
    sessionContinuationRate: gamePairs.length > 0 ? continued.length / gamePairs.length : null,
    closeLossAvailable: closeAvailable.length,
    closeLossClicked: closeClicked.length,
    closeLossReplayRate: closeAvailable.length > 0 ? closeClicked.length / closeAvailable.length : null,
    firstPicks: picks.get(gameId) ?? 0,
    firstPickShare: totalFirstPicks > 0 ? (picks.get(gameId) ?? 0) / totalFirstPicks : null,
    // Diagnostico, no enganche: se ensena AL LADO del compuesto, nunca dentro.
    // "poco fun" + "rendimiento malo" y "poco fun" + "rendimiento perfecto"
    // son dos diagnosticos distintos, y promediarlos en un solo numero
    // borraria justo la distincion que hace falta ver.
    framesSampled: perf.framesSampled,
    longFrameRate50: perf.longFrameRate50,
    longFrameRate100: perf.longFrameRate100,
    worstFrameMs: perf.worstFrameMs,
    confidence: confidenceOf(finishesCount),
    insufficient: finishesCount < MIN_FINISHES,
  };
}

/**
 * Cinco numeros por partida (frameCount, slowFrames50, slowFrames100,
 * worstFrameMs) viajan en el meta de cada game_finish -ver App.finishRun()
 * en el cliente-, sumados aqui por juego. Sin marca de tiempo por fotograma,
 * sin profiler: solo agregados que ya llegaron contados desde el propio
 * bucle de render (GameHost).
 */
function performanceFor(finishEvents) {
  let framesSampled = 0;
  let slow50 = 0;
  let slow100 = 0;
  let worstFrameMs = 0;
  for (const e of finishEvents) {
    const meta = parseMeta(e.meta);
    if (typeof meta.frameCount !== 'number') continue; // partidas de antes de este parche: sin dato, no un cero
    framesSampled += meta.frameCount;
    if (typeof meta.slowFrames50 === 'number') slow50 += meta.slowFrames50;
    if (typeof meta.slowFrames100 === 'number') slow100 += meta.slowFrames100;
    if (typeof meta.worstFrameMs === 'number') worstFrameMs = Math.max(worstFrameMs, meta.worstFrameMs);
  }
  return {
    framesSampled,
    longFrameRate50: framesSampled > 0 ? slow50 / framesSampled : null,
    longFrameRate100: framesSampled > 0 ? slow100 / framesSampled : null,
    worstFrameMs: framesSampled > 0 ? worstFrameMs : null,
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
