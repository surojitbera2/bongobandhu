// Bongo Bandhu PWA service worker — caching + Web Push handler.
const CACHE = "bongobandhu-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
  "/favicon-16.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("/")))
  );
});

// ----- Web Push: Incoming call notification (with sound + vibration) -----
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } catch { data = { title: "Bongo Bandhu", body: event.data.text() }; }
  }
  const title = data.title || "Bongo Bandhu";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "bongobandhu-notification",
    requireInteraction: data.type === "incoming_call",
    vibrate: data.type === "incoming_call" ? [400, 200, 400, 200, 400, 200, 400] : [200, 100, 200],
    data: data,
    actions: data.type === "incoming_call" ? [
      { action: "open", title: "Open" },
    ] : [],
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.type === "incoming_call" ? "/provider" : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          c.postMessage({ type: "notification-click", data });
          if ("focus" in c) return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
