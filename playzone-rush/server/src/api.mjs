/**
 * Logica de la API. Funciones puras sobre el almacen: el servidor HTTP solo
 * enruta y traduce a JSON, asi que todo esto se puede probar sin abrir sockets.
 */
import { config } from './config.mjs';
import { inviteCode, newId, newSecret } from './ids.mjs';
import { dayKeyFor } from './time.mjs';
import { ApiError, attemptLimitFor, cleanName, validateScorePayload } from './validate.mjs';

/** Retos que forman el "dia completo" para el reto secreto. */
const DAILY_CHALLENGES = ['c1', 'c2', 'c3'];

export function createApi(store, options = {}) {
  const now = options.now ?? (() => Date.now());
  const timezone = options.timezone ?? config.timezone;
  const publish = options.publish ?? (() => {});

  const serverDay = () => dayKeyFor(now(), timezone);

  /* ------------------------------------------------------------------ */
  /* Grupos e identidad                                                  */
  /* ------------------------------------------------------------------ */

  function createGroup({ name }) {
    const playerName = cleanName(name);
    const ts = now();
    let code = null;
    // El codigo es aleatorio, no secuencial. Reintenta si choca.
    for (let i = 0; i < 12 && code === null; i++) {
      const candidate = inviteCode(4);
      if (!store.groupByCode.get(candidate)) code = candidate;
    }
    if (code === null) throw new ApiError(503, 'code_exhausted', 'No hay codigos libres');

    const groupId = newId();
    store.insertGroup.run(groupId, code, timezone, 's1', config.maxPlayersPerGroup, ts);
    const player = insertPlayer(groupId, playerName, ts);
    markSeen(player.id, serverDay(), ts);

    return {
      group: publicGroup(store.groupById.get(groupId)),
      player,
      snapshot: buildSnapshot(groupId, serverDay()),
    };
  }

  function joinGroup({ code, name }) {
    const playerName = cleanName(name);
    const group = store.groupByCode.get(String(code ?? '').toUpperCase().trim());
    if (!group) throw new ApiError(404, 'group_not_found', 'Ese grupo no existe');

    const count = store.countPlayers.get(group.id).n;
    if (count >= group.max_players) throw new ApiError(409, 'group_full', 'El grupo esta completo');

    const ts = now();
    const player = insertPlayer(group.id, playerName, ts);
    markSeen(player.id, serverDay(), ts);
    const snapshot = buildSnapshot(group.id, serverDay());
    publish(group.id, snapshot);

    return { group: publicGroup(group), player, snapshot };
  }

  function insertPlayer(groupId, name, ts) {
    const id = newId();
    const secret = newSecret();
    store.insertPlayer.run(id, groupId, name, secret, ts, ts);
    return { id, name, secret, groupId };
  }

  /** Resuelve el "Bearer <playerId>.<secret>" y marca presencia. */
  function authenticate(token) {
    if (typeof token !== 'string' || !token.includes('.')) {
      throw new ApiError(401, 'unauthorized', 'Falta la credencial');
    }
    const index = token.indexOf('.');
    const playerId = token.slice(0, index);
    const secret = token.slice(index + 1);
    const player = store.playerById.get(playerId);
    if (!player || player.secret !== secret) {
      throw new ApiError(401, 'unauthorized', 'Credencial invalida');
    }
    return player;
  }

  function touch(player) {
    const ts = now();
    store.touchPlayer.run(ts, player.id);
    markSeen(player.id, serverDay(), ts);
  }

  function markSeen(playerId, day, ts) {
    store.markPresence.run(day, playerId, ts);
  }

  function rename(player, name) {
    const clean = cleanName(name);
    store.renamePlayer.run(clean, player.id);
    const snapshot = buildSnapshot(player.group_id, serverDay());
    publish(player.group_id, snapshot);
    return { name: clean, snapshot };
  }

  /* ------------------------------------------------------------------ */
  /* Snapshot: la foto del grupo que consume el cliente                  */
  /* ------------------------------------------------------------------ */

  function buildSnapshot(groupId, day) {
    const group = store.groupById.get(groupId);
    if (!group) throw new ApiError(404, 'group_not_found');
    const ts = now();

    const players = store.playersByGroup.all(groupId);
    const scores = store.scoresForGroupDay.all(groupId, day);
    const presence = store.presenceForGroupDay.all(groupId, day);
    const ghosts = store.ghostsForGroupDay.all(groupId, day);

    const seenToday = new Set(presence.map((row) => row.player_id));
    const byPlayer = new Map();
    for (const row of scores) {
      if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, new Map());
      byPlayer.get(row.player_id).set(row.challenge_id, row);
    }

    const members = players.map((player) => {
      const rows = byPlayer.get(player.id) ?? new Map();
      const completedDaily = DAILY_CHALLENGES.every((id) => (rows.get(id)?.plays ?? 0) > 0);
      return {
        id: player.id,
        name: player.name,
        joinedAt: player.joined_at,
        lastSeenAt: player.last_seen_at,
        online: ts - player.last_seen_at <= config.onlineWindowMs,
        activeToday: seenToday.has(player.id),
        completedDaily,
      };
    });

    // Reto secreto: participan quienes han abierto PLAYZONE hoy. Asi el que
    // entro una vez hace un mes no bloquea al grupo para siempre.
    const active = members.filter((m) => m.activeToday);
    const ready = active.filter((m) => m.completedDaily);
    const minActive = Math.min(2, members.length);
    const unlocked = active.length >= minActive && active.length > 0 && ready.length === active.length;

    return {
      serverTime: ts,
      day,
      group: {
        code: group.code,
        maxPlayers: group.max_players,
        timezone: group.timezone,
        season: group.season,
      },
      members,
      scores: scores.map((row) => ({
        playerId: row.player_id,
        challengeId: row.challenge_id,
        gameId: row.game_id,
        bestScore: row.best_score,
        attemptsUsed: row.attempts_used,
        plays: row.plays,
        countsForRanking: row.counts_ranking === 1,
        updatedAt: row.updated_at,
      })),
      secret: {
        unlocked,
        activeCount: active.length,
        readyCount: ready.length,
        missing: active.filter((m) => !m.completedDaily).map((m) => m.name),
      },
      ghosts: ghosts.map((row) => ({
        playerId: row.player_id,
        gameId: row.game_id,
        score: row.score,
        durationMs: row.duration_ms,
        bytes: row.bytes,
      })),
    };
  }

  function snapshotFor(player) {
    touch(player);
    return buildSnapshot(player.group_id, serverDay());
  }

  /* ------------------------------------------------------------------ */
  /* Resultados                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Guarda un resultado.
   *
   * Reglas:
   *  - idempotente por attemptId (una conexion mala reintenta sin duplicar);
   *  - el mejor resultado nunca baja;
   *  - los intentos los cuenta el servidor (plays) y se queda con el maximo
   *    entre lo que el cuenta y lo que dice el cliente, tope incluido.
   */
  function submitScore(player, body) {
    const day = serverDay();
    const payload = validateScorePayload(body, day);
    touch(player);

    const previous = store.attemptById.get(payload.attemptId);
    if (previous) {
      // Ya procesado: devolvemos exactamente la misma respuesta.
      return { ...JSON.parse(previous.response), duplicate: true };
    }

    const limit = attemptLimitFor(payload.challengeId);
    const existing = store.scoreRow.get(day, player.id, payload.challengeId);
    const playsBefore = existing?.plays ?? 0;
    if (playsBefore >= limit) {
      throw new ApiError(409, 'attempts_exhausted', 'No quedan intentos en ese reto');
    }

    const bestBefore = existing?.best_score ?? 0;
    const bestAfter = Math.max(bestBefore, payload.score);
    const attemptsAfter = Math.min(limit, Math.max(playsBefore + 1, payload.attemptsUsed));
    const ts = now();

    store.upsertScore.run(
      day,
      player.id,
      payload.challengeId,
      payload.gameId,
      bestAfter,
      attemptsAfter,
      1,
      payload.countsForRanking ? 1 : 0,
      ts,
    );

    // El ghost solo se guarda si esta partida ha mejorado la marca del dia.
    let ghostStored = false;
    if (payload.ghost && payload.score >= bestAfter && payload.score > 0) {
      store.upsertGhost.run(
        day,
        player.id,
        payload.gameId,
        payload.score,
        payload.ghost.durationMs,
        payload.ghost.trace,
        ts,
      );
      ghostStored = true;
    }

    store.insertEvent.run(
      ts,
      player.group_id,
      player.id,
      day,
      'score_submitted',
      payload.gameId,
      payload.score,
      JSON.stringify({ challengeId: payload.challengeId, improved: payload.score > bestBefore }),
    );

    const snapshot = buildSnapshot(player.group_id, day);
    const response = {
      ok: true,
      day,
      challengeId: payload.challengeId,
      bestScore: bestAfter,
      improved: payload.score > bestBefore,
      attemptsUsed: attemptsAfter,
      attemptsLeft: Math.max(0, limit - attemptsAfter),
      ghostStored,
      snapshot,
    };

    store.insertAttempt.run(payload.attemptId, player.id, day, ts, JSON.stringify(response));
    publish(player.group_id, snapshot);
    return response;
  }

  /* ------------------------------------------------------------------ */
  /* Ghost                                                               */
  /* ------------------------------------------------------------------ */

  function getGhost(player, { playerId, gameId, day }) {
    const target = store.playerById.get(String(playerId ?? ''));
    if (!target) throw new ApiError(404, 'player_not_found', 'Ese jugador no existe');
    if (target.group_id !== player.group_id) {
      throw new ApiError(403, 'forbidden', 'Ese jugador no es de tu grupo');
    }
    const row = store.ghostRow.get(day ?? serverDay(), target.id, String(gameId ?? ''));
    if (!row) return { ghost: null };
    return {
      ghost: {
        playerId: row.player_id,
        playerName: target.name,
        gameId: row.game_id,
        score: row.score,
        durationMs: row.duration_ms,
        trace: row.trace,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Telemetria de producto                                              */
  /* ------------------------------------------------------------------ */

  function recordEvents(player, body) {
    const list = Array.isArray(body?.events) ? body.events.slice(0, 200) : [];
    const ts = now();
    let stored = 0;
    for (const event of list) {
      if (!event || typeof event.type !== 'string' || event.type.length > 40) continue;
      store.insertEvent.run(
        typeof event.ts === 'number' && Number.isFinite(event.ts) ? Math.round(event.ts) : ts,
        player.group_id,
        player.id,
        typeof event.day === 'string' ? event.day.slice(0, 10) : serverDay(),
        event.type,
        typeof event.gameId === 'string' ? event.gameId.slice(0, 24) : null,
        typeof event.value === 'number' && Number.isFinite(event.value) ? Math.round(event.value) : null,
        event.meta ? JSON.stringify(event.meta).slice(0, 500) : null,
      );
      stored++;
    }
    return { ok: true, stored };
  }

  function groupStats(player, limit = 50) {
    const counts = {};
    for (const row of store.countEventsByType.all(player.group_id)) counts[row.type] = row.n;
    const recent = store.eventsForGroup.all(player.group_id, limit).map((row) => ({
      ts: row.ts,
      playerId: row.player_id,
      type: row.type,
      day: row.day,
      gameId: row.game_id,
      value: row.value,
    }));
    const available = counts.revenge_available ?? 0;
    const clicked = counts.revenge_clicked ?? 0;
    return {
      counts,
      revengeRate: available > 0 ? clicked / available : null,
      recent,
    };
  }

  return {
    serverDay,
    createGroup,
    joinGroup,
    authenticate,
    snapshotFor,
    buildSnapshot,
    submitScore,
    getGhost,
    rename,
    recordEvents,
    groupStats,
    touch,
  };
}

function publicGroup(row) {
  return {
    code: row.code,
    maxPlayers: row.max_players,
    timezone: row.timezone,
    season: row.season,
    createdAt: row.created_at,
  };
}
