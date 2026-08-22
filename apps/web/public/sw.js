// Woodshed AI service worker (Bölüm 7 Ajan 7 + Bölüm 7 Ajan 8): "ana ekrana
// ekle" desteği + son işlenmiş stem'lerin ve son açılan projelerin/parça
// listelerinin temel çevrimdışı önbelleklenmesi.
//
// Stem'ler Supabase'in imzalı (signed) URL'leri üzerinden servis edilir; her
// ziyarette token'ı farklı yeni bir URL üretilir. Bu yüzden önbellek anahtarı
// olarak tam URL yerine query string'i (token) atılmış "normalize edilmiş"
// path kullanılır — aksi halde her ziyarette önbellek ıskalanırdı.

const AUDIO_CACHE = "woodshed-audio-v1";
const API_CACHE = "woodshed-api-v1";
const AUDIO_EXTENSIONS = [".wav", ".mp3", ".m4a"];

function isAudioRequest(url) {
  const pathname = new URL(url).pathname;
  return (
    AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext)) ||
    pathname.includes("/storage/v1/object/sign/")
  );
}

// Ajan 8: son açılan proje/parça listelerinin çevrimdışı erişimi için
// `GET /tracks` ve `GET /tracks/:id` API yanıtları da önbelleğe alınır.
function isCacheableApiRequest(url) {
  const pathname = new URL(url).pathname;
  return /^\/tracks(\/[^/]+)?$/.test(pathname);
}

function normalizedCacheKey(url) {
  const parsed = new URL(url);
  return parsed.origin + parsed.pathname;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (isAudioRequest(request.url)) {
    const cacheKey = normalizedCacheKey(request.url);

    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          await cache.put(cacheKey, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (isCacheableApiRequest(request.url)) {
    // Ağ-öncelikli (network-first): çevrimiçiyken her zaman güncel veri,
    // çevrimdışıyken son başarılı yanıt gösterilir.
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw err;
        }
      }),
    );
  }
});
