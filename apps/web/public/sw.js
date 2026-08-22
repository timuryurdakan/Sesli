// Woodshed AI service worker (Bölüm 7 Ajan 7): "ana ekrana ekle" desteği +
// son işlenmiş stem'lerin temel çevrimdışı önbelleklenmesi.
//
// Stem'ler Supabase'in imzalı (signed) URL'leri üzerinden servis edilir; her
// ziyarette token'ı farklı yeni bir URL üretilir. Bu yüzden önbellek anahtarı
// olarak tam URL yerine query string'i (token) atılmış "normalize edilmiş"
// path kullanılır — aksi halde her ziyarette önbellek ıskalanırdı.

const AUDIO_CACHE = "woodshed-audio-v1";
const AUDIO_EXTENSIONS = [".wav", ".mp3", ".m4a"];

function isAudioRequest(url) {
  const pathname = new URL(url).pathname;
  return (
    AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext)) ||
    pathname.includes("/storage/v1/object/sign/")
  );
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
  if (!isAudioRequest(request.url)) return;

  const cacheKey = normalizedCacheKey(request.url);

  event.respondWith(
    caches.open(AUDIO_CACHE).then(async (cache) => {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(cacheKey, response.clone());
        }
        return response;
      } catch (err) {
        // Çevrimdışı ve önbellekte yoksa: tarayıcının doğal ağ hatasını fırlat.
        throw err;
      }
    }),
  );
});
