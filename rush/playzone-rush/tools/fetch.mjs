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

/**
 * Igual que fetchWithTimeout, pero para cuando solo interesan el estado y las
 * cabeceras: consume el cuerpo antes de devolver la respuesta.
 *
 * No es una cortesia, es obligatorio. undici (el fetch de Node) no devuelve la
 * conexion al pool hasta que alguien lee o cancela el cuerpo. En localhost da
 * igual porque abre conexiones nuevas sin limite, pero a traves de Tailscale
 * Funnel la concurrencia util es de UNA conexion: una sola respuesta sin leer
 * deja la siguiente peticion esperando para siempre.
 *
 * Encontrado en produccion: alfa.mjs pasaba 42/42 contra 127.0.0.1 y se
 * quedaba clavado en POST /api/groups a traves del Funnel. La causa no estaba
 * en el servidor ni en el proxy, sino aqui: antes se habia descargado el
 * bundle (133 KB) mirando solo la cabecera cache-control, sin leerlo.
 */
export async function fetchHeaders(url, init = {}, timeoutMs) {
  const response = await fetchWithTimeout(url, init, timeoutMs);
  await response.arrayBuffer();
  return response;
}
