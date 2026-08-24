// ════════════════════════════════════════════════════════════
//  sw.js — service worker de Flight Strike
// ════════════════════════════════════════════════════════════
//
//  Nada de lista de ficheros a mano: con más de 250 assets (audio, art,
//  runtime por misión...) una lista escrita a mano se queda desfasada el
//  día que alguien añada uno y se te olvide aquí. En su lugar: "cache
//  según se pide" (network-first, con la copia en caché de red de
//  respaldo). La primera vez que se abre con red hace falta conexión,
//  como cualquier página; a partir de ahí, lo que ya se cargó una vez
//  sigue disponible sin ella.
//
//  CACHE_VERSION es la única palanca para forzar que todo el mundo
//  descargue de nuevo tras un cambio grande: subirla borra la caché
//  vieja en el siguiente arranque.
const CACHE_VERSION = "flight-strike-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Solo GET, y solo del mismo origen: nada de tocar peticiones a APIs
  // externas ni de interferir con lo que no es un fichero del juego.
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(e.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(e.request).then((c) => c || Promise.reject("sin red y sin caché")))
  );
});
