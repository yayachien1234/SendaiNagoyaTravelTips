const CACHE_NAME = "trip-cache-v2";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./data.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // 訂位/訂房/票券證明（離線也要能開）
  "./attachments/flight-tpe-sdj.pdf",
  "./attachments/flight-sdj-ngo-yeh.pdf",
  "./attachments/flight-sdj-ngo-dad.pdf",
  "./attachments/flight-sdj-ngo-mom.pdf",
  "./attachments/hotel-apa-sendai.pdf",
  "./attachments/hotel-matsushima-taikanso-room-01.pdf",
  "./attachments/hotel-matsushima-taikanso-room-02.pdf",
  "./attachments/hotel-nagoya-airbnb.pdf",
  "./attachments/dinner-umagakoi.pdf",
  "./attachments/lunch-donmatsushima.pdf",
  "./attachments/dinner-unafuji-haera.pdf",
  "./attachments/dinner-bakuroichidai.pdf",
  "./attachments/dinner-lamian.pdf",
  "./attachments/transit-airport-to-sendai.webp",
  "./attachments/transit-sendai-to-airport.webp",
  "./attachments/transit-sendai-to-matsushima.pdf",
  "./attachments/transit-matsushima-to-sendai.pdf",
  "./attachments/transit-ninohe-to-karumai.pdf",
  "./attachments/transit-karumai-to-ninohe.pdf",
  "./attachments/transit-centrair-to-meitetsu-nagoya.pdf",
  "./attachments/dinner-zenjiro.pdf",
  "./attachments/dinner-kaku.png",
  "./attachments/flight-ngo-tpe.pdf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// attachments（大型PDF/圖片，內容不會變）走cache-first避免每次重新下載；
// 其他一律network-first：有網路拿最新版並更新快取，離線才退回快取
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const isAttachment = new URL(event.request.url).pathname.includes("/attachments/");
  if (isAttachment) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      }))
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
