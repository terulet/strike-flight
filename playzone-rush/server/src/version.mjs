/**
 * Identificador de build. El cliente lo incrusta en tiempo de compilacion
 * (vite.config.ts hace lo mismo con este mismo comando) y el servidor lo
 * calcula al arrancar; como los dos leen el mismo repositorio en la misma
 * maquina, coinciden. Sirve para que el cliente sepa que hay una version
 * nueva desplegada sin depender de que el service worker se entere solo
 * (Safari en iOS no siempre revisa las actualizaciones a tiempo).
 */
import { execSync } from 'node:child_process';

let cached = null;

export function computeBuildId() {
  if (cached) return cached;
  try {
    cached = execSync('git rev-parse --short HEAD', {
      cwd: new URL('../..', import.meta.url).pathname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    cached = `dev-${Date.now().toString(36)}`;
  }
  return cached;
}
