/**
 * Backup automatico del SQLite.
 *
 * `VACUUM INTO` es la forma segura de copiar una base SQLite en caliente: a
 * diferencia de un `cp`, no puede pillar el fichero a medio escribir aunque
 * haya jugadores puntuando en ese instante (funciona bien con WAL). Sencillo
 * a proposito: copias locales rotadas, sin infraestructura externa. La carpeta
 * de backups vive dentro de `server/data/`, asi que si el Mac tiene Time
 * Machine (lo tiene, por defecto), esas copias quedan respaldadas tambien
 * fuera del disco sin hacer nada mas.
 */
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

function timestampName() {
  return `playzone-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
}

export function runBackup(db, dir) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, timestampName());
  const escaped = path.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
  return path;
}

function pruneOldBackups(dir, keep) {
  let entries;
  try {
    entries = readdirSync(dir)
      .filter((name) => name.startsWith('playzone-') && name.endsWith('.db'))
      .map((name) => ({ name, path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return;
  }
  for (const entry of entries.slice(keep)) {
    try {
      unlinkSync(entry.path);
    } catch {
      /* si no se puede borrar una copia vieja, no es motivo para tumbar el server */
    }
  }
}

/**
 * Arranca el ciclo de copias. Hace una nada mas arrancar (asi un deploy
 * nuevo ya tiene una copia de partida) y luego cada `intervalMs`.
 */
export function startBackupSchedule(db, { dir, intervalMs, keep }) {
  let lastAt = null;
  let lastPath = null;
  let lastError = null;

  function tick() {
    try {
      lastPath = runBackup(db, dir);
      lastAt = Date.now();
      lastError = null;
      pruneOldBackups(dir, keep);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error('[playzone] backup fallido:', lastError);
    }
  }

  // Un pequeno margen tras arrancar: que el servidor responda antes de gastar
  // el primer ciclo de I/O en copiar la base de datos.
  const initial = setTimeout(tick, 5_000);
  const interval = setInterval(tick, Math.max(60_000, intervalMs));
  interval.unref?.();
  initial.unref?.();

  return {
    stop() {
      clearTimeout(initial);
      clearInterval(interval);
    },
    last() {
      return lastPath ? { at: lastAt, path: lastPath, error: lastError } : null;
    },
    runNow: () => tick(),
  };
}
