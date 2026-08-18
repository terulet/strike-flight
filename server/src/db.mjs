/**
 * Base de datos: SQLite del propio Node (node:sqlite). Cero dependencias, un
 * fichero, y se borra con un rm si hay que empezar de cero.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  timezone    TEXT NOT NULL,
  season      TEXT NOT NULL DEFAULT 's1',
  max_players INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  secret       TEXT NOT NULL,
  joined_at    INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_by_group ON players(group_id);

-- Una fila por (dia, jugador, reto). El best_score solo sube.
CREATE TABLE IF NOT EXISTS scores (
  day           TEXT NOT NULL,
  player_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  challenge_id  TEXT NOT NULL,
  game_id       TEXT NOT NULL,
  best_score    INTEGER NOT NULL,
  attempts_used INTEGER NOT NULL,
  plays         INTEGER NOT NULL DEFAULT 0,
  counts_ranking INTEGER NOT NULL DEFAULT 1,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (day, player_id, challenge_id)
);
CREATE INDEX IF NOT EXISTS scores_by_day ON scores(day);

-- Idempotencia: el mismo intento enviado dos veces se procesa una vez.
CREATE TABLE IF NOT EXISTS attempts (
  attempt_id TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  response   TEXT NOT NULL
);

-- Solo se guarda la traza del mejor intento del dia en ese juego.
CREATE TABLE IF NOT EXISTS ghosts (
  day         TEXT NOT NULL,
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id     TEXT NOT NULL,
  score       INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  trace       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (day, player_id, game_id)
);

-- "Ha abierto PLAYZONE hoy": es quien cuenta para abrir el reto secreto.
CREATE TABLE IF NOT EXISTS presence (
  day       TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seen_at   INTEGER NOT NULL,
  PRIMARY KEY (day, player_id)
);

-- Telemetria de producto. Sin datos personales: id aleatorio y poco mas.
CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  group_id  TEXT NOT NULL,
  player_id TEXT NOT NULL,
  day       TEXT NOT NULL,
  type      TEXT NOT NULL,
  game_id   TEXT,
  value     INTEGER,
  meta      TEXT
);
CREATE INDEX IF NOT EXISTS events_by_group ON events(group_id, ts);
`;

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

/** Envoltorio con las consultas que usa la API. Nada de ORM. */
export function createStore(db) {
  const q = {
    insertGroup: db.prepare(
      'INSERT INTO groups (id, code, timezone, season, max_players, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    groupByCode: db.prepare('SELECT * FROM groups WHERE code = ?'),
    groupById: db.prepare('SELECT * FROM groups WHERE id = ?'),
    insertPlayer: db.prepare(
      'INSERT INTO players (id, group_id, name, secret, joined_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    playerById: db.prepare('SELECT * FROM players WHERE id = ?'),
    playersByGroup: db.prepare('SELECT * FROM players WHERE group_id = ? ORDER BY joined_at ASC'),
    countPlayers: db.prepare('SELECT COUNT(*) AS n FROM players WHERE group_id = ?'),
    touchPlayer: db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?'),
    renamePlayer: db.prepare('UPDATE players SET name = ? WHERE id = ?'),

    scoreRow: db.prepare('SELECT * FROM scores WHERE day = ? AND player_id = ? AND challenge_id = ?'),
    upsertScore: db.prepare(`
      INSERT INTO scores (day, player_id, challenge_id, game_id, best_score, attempts_used, plays, counts_ranking, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(day, player_id, challenge_id) DO UPDATE SET
        best_score    = MAX(scores.best_score, excluded.best_score),
        attempts_used = MAX(scores.attempts_used, excluded.attempts_used),
        plays         = scores.plays + 1,
        game_id       = excluded.game_id,
        counts_ranking = excluded.counts_ranking,
        updated_at    = excluded.updated_at
    `),
    scoresForGroupDay: db.prepare(`
      SELECT s.* FROM scores s
      JOIN players p ON p.id = s.player_id
      WHERE p.group_id = ? AND s.day = ?
    `),

    attemptById: db.prepare('SELECT * FROM attempts WHERE attempt_id = ?'),
    insertAttempt: db.prepare(
      'INSERT INTO attempts (attempt_id, player_id, day, created_at, response) VALUES (?, ?, ?, ?, ?)',
    ),

    ghostRow: db.prepare('SELECT * FROM ghosts WHERE day = ? AND player_id = ? AND game_id = ?'),
    upsertGhost: db.prepare(`
      INSERT INTO ghosts (day, player_id, game_id, score, duration_ms, trace, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(day, player_id, game_id) DO UPDATE SET
        score = excluded.score, duration_ms = excluded.duration_ms,
        trace = excluded.trace, updated_at = excluded.updated_at
    `),
    ghostsForGroupDay: db.prepare(`
      SELECT g.day, g.player_id, g.game_id, g.score, g.duration_ms, LENGTH(g.trace) AS bytes
      FROM ghosts g JOIN players p ON p.id = g.player_id
      WHERE p.group_id = ? AND g.day = ?
    `),

    markPresence: db.prepare(
      'INSERT INTO presence (day, player_id, seen_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(day, player_id) DO UPDATE SET seen_at = excluded.seen_at',
    ),
    presenceForGroupDay: db.prepare(`
      SELECT pr.player_id, pr.seen_at FROM presence pr
      JOIN players p ON p.id = pr.player_id
      WHERE p.group_id = ? AND pr.day = ?
    `),

    insertEvent: db.prepare(
      'INSERT INTO events (ts, group_id, player_id, day, type, game_id, value, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    eventsForGroup: db.prepare(
      'SELECT * FROM events WHERE group_id = ? ORDER BY ts DESC LIMIT ?',
    ),
    countEventsByType: db.prepare(
      'SELECT type, COUNT(*) AS n FROM events WHERE group_id = ? GROUP BY type',
    ),
  };
  return q;
}
