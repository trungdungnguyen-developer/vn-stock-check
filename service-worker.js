const CACHE_NAME = "stock-tracker-vietnam-app-v58";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./css/legacy.css",
  "./css/design-tokens.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/surfaces.css",
  "./css/controls.css",
  "./css/navigation.css",
  "./css/tables.css",
  "./css/semantic.css",
  "./css/charts.css",
  "./css/links.css",
  "./css/notifications.css",
  "./css/responsive.css",
  "./script.js",
  "./risk.js",
  "./portfolio.js",
  "./ai.js",
  "./src/app/bootstrap.js",
  "./src/app/main.js",
  "./src/api/stockApi.js",
  "./src/api/cryptoApi.js",
  "./src/api/newsApi.js",
  "./src/indicator/rsi.js",
  "./src/indicator/macd.js",
  "./src/indicator/ma.js",
  "./src/indicator/adx.js",
  "./src/strategy/marketScanner.js",
  "./src/strategy/tradeAnalysis.js",
  "./src/strategy/entryAnalysis.js",
  "./src/strategy/scoreAnalysis.js",
  "./src/ui/chart.js",
  "./src/ui/dashboard.js",
  "./src/ui/analytics.js",
  "./src/ui/table.js",
  "./src/ui/notification.js",
  "./src/ui/watchlist.js",
  "./src/utils/number.js",
  "./src/utils/date.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.includes("/.netlify/functions/") || url.searchParams.has("source") || url.searchParams.has("path");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetched = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetched;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (isApiRequest(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate" || ["script", "style", "document"].includes(event.request.destination)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
