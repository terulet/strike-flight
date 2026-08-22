/**
 * Service worker — offline shell that CANNOT trap a tester on an old build.
 *
 * Strategy:
 *   - navigations: network first, cache as the offline fallback. A new deploy is
 *     therefore picked up on the next load, not on some later eviction.
 *   - static assets: stale-while-revalidate. Instant start, fresh next time.
 *   - build-info.json / tester-challenges.json: network only. A report must never
 *     name the wrong build, and a rival table must never be stale.
 *   - the worker calls skipWaiting/clients.claim, and the page reloads once when a
 *     new worker takes control (see registerServiceWorker in main.js).
 *
 * Forced escape hatch for a tester who is somehow still stuck: ?nocache=1
 */
const VERSION = 'v1.1.0-tester';
const CACHE = `omm-${VERSION}`;
const NEVER_CACHE = ['build-info.json', 'tester-challenges.json'];

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/main.js', './src/ui/styles.css',
  './src/config/GameConfig.js', './src/config/PhysicsConfig.js', './src/config/surfaces.js',
  './src/config/objects.js', './src/config/mutators.js', './src/config/index.js',
  './src/core/math.js', './src/core/rng.js', './src/core/events.js', './src/core/Loop.js',
  './src/physics/Simulation.js', './src/physics/calibration.js',
  './src/game/Game.js', './src/game/Challenge.js', './src/game/Scoring.js',
  './src/game/Rivals.js', './src/game/Ranking.js', './src/game/Player.js',
  './src/input/Input.js',
  './src/render/Renderer.js', './src/render/Camera.js', './src/render/Particles.js',
  './src/render/shapes.js', './src/render/ShareCard.js',
  './src/audio/Audio.js', './src/audio/Haptics.js',
  './src/ui/UI.js', './src/ui/i18n.js', './src/ui/format.js',
  './src/storage/Save.js', './src/telemetry/Telemetry.js', './src/debug/Debug.js',
  './src/tester/LaunchConfig.js', './src/tester/rivalConfig.js',
  './src/tester/TesterReport.js', './src/tester/buildInfo.js',
  './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((n) => url.pathname.endsWith(n))) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
