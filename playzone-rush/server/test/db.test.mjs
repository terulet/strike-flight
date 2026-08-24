/**
 * openDatabase() sobre un fichero con el esquema VIEJO.
 *
 * CREATE TABLE IF NOT EXISTS no toca una tabla que ya existe. Si alguna vez
 * se anade una columna nueva solo ahi, cualquier playzone.db creado con una
 * version anterior del codigo se queda sin ella para siempre, y el primer
 * INSERT revienta -asi se rompio game_version/is_test la primera vez que se
 * probo contra un servidor de verdad-. Este test recrea ese escenario a
 * proposito: un fichero real con el esquema de antes de esas dos columnas.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db.mjs';

let dir;

afterEach(() => {
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function esquemaViejo(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE scores (
      day TEXT NOT NULL, player_id TEXT NOT NULL, challenge_id TEXT NOT NULL,
      game_id TEXT NOT NULL, best_score INTEGER NOT NULL, attempts_used INTEGER NOT NULL,
      plays INTEGER NOT NULL DEFAULT 0, counts_ranking INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL, PRIMARY KEY (day, player_id, challenge_id)
    );
    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, group_id TEXT NOT NULL,
      player_id TEXT NOT NULL, day TEXT NOT NULL, type TEXT NOT NULL, game_id TEXT,
      value INTEGER, meta TEXT
    );
  `);
  db.close();
}

describe('migracion de esquema', () => {
  it('anade game_version e is_test a un scores.db que no las tenia', () => {
    dir = mkdtempSync(join(tmpdir(), 'playzone-db-'));
    const path = join(dir, 'viejo.db');
    esquemaViejo(path);

    const migrada = openDatabase(path);
    const columnas = migrada.prepare('PRAGMA table_info(scores)').all().map((c) => c.name);
    expect(columnas).toContain('game_version');
    expect(columnas).toContain('is_test');
    migrada.close();
  });

  it('anade game_version e is_test a un events que no las tenia', () => {
    dir = mkdtempSync(join(tmpdir(), 'playzone-db-'));
    const path = join(dir, 'viejo.db');
    esquemaViejo(path);

    const migrada = openDatabase(path);
    const columnas = migrada.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
    expect(columnas).toContain('game_version');
    expect(columnas).toContain('is_test');
    migrada.close();
  });

  it('el fichero migrado admite insertar con las columnas nuevas', () => {
    dir = mkdtempSync(join(tmpdir(), 'playzone-db-'));
    const path = join(dir, 'viejo.db');
    esquemaViejo(path);

    const migrada = openDatabase(path);
    expect(() =>
      migrada
        .prepare(
          'INSERT INTO scores (day, player_id, challenge_id, game_id, game_version, best_score, attempts_used, plays, counts_ranking, is_test, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run('2026-08-24', 'p1', 'c1', 'pulse', 2, 1000, 1, 1, 1, 0, Date.now()),
    ).not.toThrow();
    migrada.close();
  });

  it('abrir dos veces seguidas (esquema ya al dia) no falla ni duplica columnas', () => {
    dir = mkdtempSync(join(tmpdir(), 'playzone-db-'));
    const path = join(dir, 'nuevo.db');
    openDatabase(path).close();
    const segunda = openDatabase(path);
    const columnas = segunda.prepare('PRAGMA table_info(scores)').all().map((c) => c.name);
    expect(columnas.filter((c) => c === 'game_version')).toHaveLength(1);
    segunda.close();
  });
});
