/* GhostUe46 · Service worker: deja la app disponible sin conexión (solo la interfaz; el chat necesita Internet). */
const CACHE = 'ghostue46-v16-console-debug-liquid-glass';
const SHELL = [
  './', 'index.html', 'creator.html', 'consola-debugg.js', 'adaptive-contrast.js', 'adaptive-contrast.css', 'error-report.js', 'error-report.css', 'tts.js', 'tts.css', 'styles.css', 'ui-plus.css', 'intelligence.css', 'icon-sets.css', 'gingerbread.css', 'theme-media.css', 'extras.css', 'animus.css', 'synthwave.css', 'customize.css',
  'illusion-studio.css', 'illusion-studio.js', 'fusion-scroll.js', 'ambience-sound.js', 'ui-sounds.js', 'sounds/click.mp3', 'sounds/notification.mp3', 'assets/claude-starburst.png',
  'tailwind-config.js', 'fonts-list.js', 'app.js', 'ui-plus.js', 'intelligence.js', 'theme-media.js', 'extras.js',
  'manifest.webmanifest', 'assets/site-icon.svg', 'assets/animus-mark.svg', 'assets/site-icon-32.png', 'assets/site-icon-192.png', 'assets/site-icon-512.png',
  'assets/logo-anthropic.svg',
  'assets/logo-claude.svg',
  'assets/logo-openai.svg',
  'assets/logo-chatgpt.svg',
  'assets/logo-xai.svg',
  'assets/logo-grok.svg',
  'assets/logo-google.svg',
  'assets/logo-gemini.svg',
  'assets/thanks-logos/anthropic.png',
  'assets/thanks-logos/openai.png',
  'assets/thanks-logos/google.png',
  'assets/thanks-logos/grok.png',
  'assets/thanks-logos/gemini.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nunca se interceptan las llamadas a APIs de IA ni a otros orígenes: van directas a la red.
  if (url.origin !== location.origin) return;
  // Red primero (siempre la versión más nueva) y, si no hay conexión, lo guardado.
  e.respondWith(fetch(req).then((res) => {
    if (res && res.status === 200 && !url.pathname.includes('/sounds/')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
