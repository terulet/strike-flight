/**
 * fetch() de Node no tiene limite de tiempo por defecto. Contra un proxy que
 * se quede colgado (Funnel, un tunel lento, lo que sea) una peticion sin
 * AbortSignal espera para siempre, y entonces la prueba no falla: se queda
 * ahi hasta que alguien la mate a mano y no sepa muy bien por que.
 *
 * Encontrado en produccion: el harness se colgo en el Mac Mini hablando con
 * la API a traves de Tailscale Funnel, sin ningun mensaje de error.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Tiempo agotado (${timeoutMs} ms) esperando ${init.method ?? 'GET'} ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
