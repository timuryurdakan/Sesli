# Stage 09 — Senkronize Prova Modu (Gerçek Zamanlı Ortak Görüntüleme)

**Ajan:** 9 (Senkronize Prova Modu)
**Bağımlılık:** Ajan 7, Ajan 8 (tamamlandı)
**Durum:** Kod tamamlandı, build/lint/test yeşil. **Gerçek çoklu-cihaz senkronizasyonu gerçek bir Supabase projesi gerektirdiği için canlı test edilemedi** (tüm önceki stage'lerdeki aynı sınırlama) — ancak Supabase Realtime Authorization API'sinin doğru kullanımı (özellikle güvenlik açısından kritik olan `private: true` + RLS parçası) bizzat kütüphanenin tip tanımlarından satır satır doğrulandı.

## Mimari: Supabase Realtime "Private" Broadcast Kanalları

- Kanal adı: **`practice-{auth.uid()}`** — yalnızca o kullanıcının kendi hesabına ait cihazları erişebilir.
- **Güvenlik (Bölüm 7 Ajan 9 / Ajan 12'nin ayrıca denetleyeceği madde):** `supabase/migrations/0005_practice_session_realtime_auth.sql`, `realtime.messages` tablosuna `realtime.topic() = 'practice-' || auth.uid()::text` koşuluyla select/insert RLS politikaları ekliyor. Bu, yalnızca "kanal adını tahmin edememe" gibi obscurity'e değil, **JWT'ye dayalı gerçek yetkilendirmeye** dayanıyor — başka bir kullanıcının JWT'siyle bu kanala asla abone olunamaz/yayın yapılamaz.
- **Kritik istemci-tarafı gereksinim:** Kanal `{ config: { private: true } }` ile oluşturulmalı VE abone olmadan önce `supabase.realtime.setAuth()` çağrılmalı — aksi halde kanal "public" kabul edilir ve yukarıdaki RLS politikaları **hiç devreye girmez** (bu, araştırmayla doğrulanan en kritik incelik). `apps/web/lib/practice/usePracticeSession.ts` bunu doğru sırayla yapıyor.

## Lider/Takipçi Modeli

- Varsayılan: hiçbir cihaz "host" değildir, herkes bağımsız/serbestçe kendi oynatıcısını kontrol edebilir (oturum "opsiyonel"dir, zorla dayatılmaz).
- Bir cihaz **"Bu Cihazdan Yönet"** butonuna basınca `host-claim` yayını yapar; bunu alan tüm diğer cihazlar (aynı hesap) otomatik olarak **takipçi** moduna geçer: kendi transport kontrolleri (Çal/Duraklat, geri sayım seçimi) devre dışı kalır, yalnızca host'un `playback-state` yayınlarını pasif olarak uygular (`seekTo` + `play`/`pause`).
- `PracticeSessionBar` bileşeni bağlantı/rol durumunu gösterir: "bağlanıyor", "bu cihaz yönetiyor", "başka bir cihaz yönetiyor (takip modu)", veya "hazır, kimse almadı".

## Senkronizasyon Detayları

- Host, oynatma durumunu (`position`, `isPlaying`, `currentChordIndex`) **300ms'de bir throttle'lı** yayınlıyor (Bölüm 7 Ajan 9 DoD'si "<1 saniye gecikme" istiyor — 300ms bunun oldukça altında).
- Takipçi tarafında **>0.75 saniye sapma** olursa `seekTo` ile düzeltiliyor (küçük ağ jitter'ı için gereksiz sık seek'i önlemek için bir eşik kullanılıyor — tam senkron değil ama "algılanabilir gecikme olmadan" hedefine uygun).
- **Yeniden bağlanma:** Kanal `SUBSCRIBED` durumuna her geçtiğinde (ilk bağlanma VE otomatik yeniden bağlanma sonrası) istemci bir `request-state` yayını yapar; host bunu alınca anlık durumunu tekrar yayınlar — bu sayede state kaybı olmadan zarifçe toparlanma sağlanıyor (Bölüm 7 Ajan 9: "bağlantı kopması/yeniden bağlanma... state kaybı olmadan").

## Ne İnşa Edildi

- `supabase/migrations/0005_practice_session_realtime_auth.sql` — yukarıdaki RLS politikaları.
- `apps/web/lib/practice/usePracticeSession.ts` — çekirdek hook.
- `apps/web/components/player/PracticeSessionBar.tsx` — durum/rol UI'ı.
- `apps/web/lib/player/usePlayerEngine.ts`: ayrı `play()`/`pause()` fonksiyonları eklendi (önceden yalnızca toggle `playPause()` vardı — takipçi modunun host'un mutlak `isPlaying` durumunu uygulayabilmesi için gerekliydi).
- `apps/web/components/player/PlayerView.tsx`: `usePracticeSession` entegre edildi; takipçi modundayken transport kontrolleri devre dışı bırakılıyor (mikser/loop/tempo kontrolleri ise **kasıtlı olarak devre dışı bırakılmadı** — bunlar cihaza özel yerel tercihlerdir, senkronize edilmesi gerekmez).

## Ek: apps/web İçin Test Altyapısı Kuruldu (Stage 01'den beri ertelenen boşluk kapatıldı)

Stage 01 handoff'u "apps/web'de henüz test framework'ü kurulmadı" notunu düşmüş, sonraki 7 stage boyunca kimse bunu ele almamıştı. Bu stage'de **Vitest** kuruldu (`apps/web/vitest.config.mts`, `pnpm --filter web test`, kök `pnpm test`'e otomatik dahil) ve şu saf fonksiyonlar için testler yazıldı:
- `lib/player/chords.ts` (`currentChordIndexFor`) — hem `ChordStrip` hem `usePracticeSession` artık bu **tek, paylaşılan** fonksiyonu kullanıyor (önceden ikisi de kendi kopyasını tutuyordu).
- `lib/player/format.ts` (`formatTime`) — `PlayerView`'den çıkarıldı.

React bileşenleri/hook'ları (DOM, Supabase Realtime, wavesurfer.js gerektirdiğinden) için component-test altyapısı (React Testing Library + jsdom) bu stage'e dahil edilmedi — yalnızca çıkarılabilir saf mantık test edildi. İleride component testleri gerekirse `@testing-library/react` + vitest'in `jsdom` environment'ı eklenmeli.

## Gerekli Ortam Değişkenleri

Yeni yok.

## Bilinen Sınırlamalar / TODO'lar / Bir Sonraki Ajana Notlar

- **Gerçek çoklu-cihaz testi yapılamadı** — `supabase.auth.getUser()` gerçek bir oturum gerektirdiğinden `/dev/player-demo` (kimlik doğrulamasız) üzerinden bu özellik alıştırılamadı. Proje sahibi gerçek Supabase bağlandıktan sonra: iki farklı tarayıcı/cihazda aynı hesapla giriş yapıp, birinde "Bu Cihazdan Yönet"e basıp diğerinde akorun/oynatma durumunun senkronize göründüğünü doğrulamalı. **Ajan 12 ayrıca**, başka bir kullanıcının bu kanala erişemediğini (RLS'in gerçekten çalıştığını) agresif şekilde test etmeli (plan bunu özellikle istiyor).
- Host, sekmeyi kapatırsa/bağlantısı koparsa kimse otomatik olarak yeni host olmuyor — takipçiler sonsuza kadar "takip modunda" kalır, ta ki biri manuel olarak "Bu Cihazdan Yönet"e basana kadar. Bu, MVP için kabul edilebilir bir basitleştirme; istenirse "host X saniyedir sessiz, otomatik serbest bırak" gibi bir zaman aşımı eklenebilir.
- `currentChordIndex` broadcast payload'a dahil ediliyor ama takipçi tarafında şu an **kullanılmıyor** (takipçi kendi `ChordStrip`'ini kendi `engine.currentTime`'ından türetiyor, ki bu zaten host ile senkronize olduğu için doğru sonucu veriyor) — alan gelecekte bir optimizasyon veya farklı bir UI ihtiyacı için hazır bırakıldı.
