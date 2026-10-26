// MYTHOS service worker: lets the game open offline and load fast.
// Bump VERSION whenever you want every player to drop old cached files.
const VERSION = "mythos-v1";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "privacy.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // never cache the database / auth / captcha traffic
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("cloudflare.com")) return;
  if (url.origin === location.origin) {
    // game files: try the network first (so updates show up), fall back to the saved copy offline
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  // fonts and the Supabase library from CDNs: use the saved copy, refresh it in the background
  if (/(gstatic|googleapis|jsdelivr|unpkg)\./.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
