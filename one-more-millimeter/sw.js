/* Offline shell. Cache-first for the app files, network fallback for anything else. */
const CACHE = 'omm-v1.0.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './src/main.js', './src/ui/styles.css',
  './src/config/GameConfig.js', './src/config/PhysicsConfig.js', './src/config/surfaces.js',
  './src/config/objects.js', './src/config/mutators.js', './src/config/index.js',
  './src/core/math.js', './src/core/rng.js', './src/core/events.js', './src/core/Loop.js',
  './src/physics/Simulation.js', './src/physics/calibration.js',
  './src/game/Game.js', './src/game/Challenge.js', './src/game/Scoring.js',
  './src/game/Rivals.js', './src/game/Ranking.js',
  './src/input/Input.js',
  './src/render/Renderer.js', './src/render/Camera.js', './src/render/Particles.js',
  './src/render/shapes.js', './src/render/ShareCard.js',
  './src/audio/Audio.js', './src/audio/Haptics.js',
  './src/ui/UI.js', './src/ui/i18n.js', './src/ui/format.js',
  './src/storage/Save.js', './src/telemetry/Telemetry.js', './src/debug/Debug.js',
  './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
