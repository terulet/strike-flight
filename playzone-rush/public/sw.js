/**
 * Service worker minimo: que la app abra sin conexion.
 *
 * Estrategia deliberadamente simple:
 *  - /api  -> siempre red. Los datos compartidos no se cachean jamas: si no
 *             hay servidor, la app ya sabe funcionar con lo que tiene guardado.
 *  - resto -> red primero y, si falla, lo que haya en cache. Asi una build
 *             nueva se coge sola al recargar con cobertura, pero el juego
 *             sigue abriendo en el metro.
 */
// v3 en el lanzamiento: el 'activate' de abajo borra toda cache cuyo nombre no
// sea este, asi que cambiarlo garantiza que no sobreviva ni un fichero de la
// semana de prueba. La estrategia es red-primero y ya cogia las builds nuevas
// sola, pero en un arranque limpio no se deja nada al azar.
const CACHE = 'playzone-rush-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(['./', './index.html']).catch(() => undefined);
      // Los ficheros de la build llevan hash en el nombre, asi que no se pueden
      // escribir a mano: se leen del propio index.html al instalar.
      try {
        const response = await fetch('./index.html', { cache: 'reload' });
        const html = await response.text();
        const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
        await Promise.all(
          urls.map((url) => cache.add(new URL(url, self.location.href).toString()).catch(() => undefined)),
        );
      } catch {
        /* sin red al instalar: ya se cacheara al vuelo */
      }
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/**
 * La primera visita carga los assets ANTES de que el service worker controle
 * la pagina, asi que no pasan por el fetch de aqui y no se cachean. La app nos
 * manda la lista de lo que ha cargado de verdad y la guardamos.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'precache' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls.map((url) =>
          cache.match(url).then((hit) => (hit ? undefined : cache.add(url).catch(() => undefined))),
        ),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // datos vivos: nunca de cache

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        // ignoreVary es imprescindible: un <script type="module"> no se pide
        // igual que un cache.add(url), y sin esto la respuesta guardada no se
        // encuentra aunque este ahi.
        const cached =
          (await cache.match(request, { ignoreVary: true })) ??
          (await cache.match(request.url, { ignoreVary: true }));
        if (cached) return cached;
        // Navegacion sin nada concreto en cache: devolvemos el index.
        if (request.mode === 'navigate') {
          const shell =
            (await cache.match('./index.html', { ignoreVary: true })) ??
            (await cache.match('./', { ignoreVary: true }));
          if (shell) return shell;
        }
        return new Response('Sin conexion', { status: 503, statusText: 'offline' });
      }),
  );
});
