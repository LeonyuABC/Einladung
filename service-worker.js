const VERSION = "couple-space-network-v1";

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// Bewusst nur Netzwerk: Die App bleibt installierbar, ohne veraltete Daten oder
// Programmdateien offline zwischenzuspeichern. Firebase übernimmt die Daten.
self.addEventListener("fetch", (event) => {
    if (event.request.method === "GET" && new URL(event.request.url).origin === self.location.origin) {
        event.respondWith(fetch(event.request));
    }
});

self.addEventListener("message", (event) => {
    if (event.data === "VERSION") event.source?.postMessage(VERSION);
});
