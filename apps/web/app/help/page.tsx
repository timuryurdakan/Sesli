import Link from "next/link";

const FAQ = [
  {
    q: "Hangi dosya formatlarını yükleyebilirim?",
    a: "MP3, WAV, M4A ses dosyaları ve MP4/MOV video dosyaları (yalnızca sesi ayrıştırılır) desteklenir.",
  },
  {
    q: "Ses ayırma ne kadar sürer?",
    a: "Genellikle şarkı süresinin ~1.5 katı kadar sürer (ör. 4 dakikalık bir şarkı ~6 dakikada işlenir). Yoğun saatlerde kuyrukta bekleme süresi ekleneceğinden bu daha uzun sürebilir.",
  },
  {
    q: "Akorlar neden bazen yanlış çıkıyor?",
    a: "Akor tespiti temel majör/minör üçlü akorları hedefler; 7'li, sus, dim/aug gibi uzatılmış akorlar veya çok yoğun/gürültülü kayıtlarda doğruluk düşebilir.",
  },
  {
    q: "Piyano ayrımı neden diğerlerinden daha düşük kalitede?",
    a: "Kullanılan yapay zeka modelinin (Demucs) bilinen bir sınırlaması — piyano, yapısı gereği diğer 5 kanala göre ayırması daha zor bir enstrümandır.",
  },
  {
    q: "Yüklediğim dosyalar başkalarıyla paylaşılıyor mu?",
    a: "Hayır. Yüklediğiniz içerikler yalnızca kişisel pratik amacınız için işlenir, platform dışında paylaşılmaz veya yeniden dağıtılmaz. Detaylar için Kullanım Şartları'na bakın.",
  },
  {
    q: "Hesabımı ve verilerimi nasıl silebilirim?",
    a: 'Hesap Ayarları sayfasından "Hesabı Sil" ile hesabınızı ve tüm ilişkili verilerinizi kalıcı olarak silebilirsiniz (KVKK/GDPR "unutulma hakkı").',
  },
  {
    q: "Senkronize Prova Modu nasıl çalışır?",
    a: 'Bir oynatıcı sayfasında "Bu Cihazdan Yönet"e bastığınızda, aynı hesaba giriş yapmış diğer cihazlar otomatik olarak akor akışını ve oynatma durumunu gerçek zamanlı takip eder.',
  },
  {
    q: "Depolama kotam ne kadar?",
    a: "Her kullanıcının belirli bir toplam depolama kotası vardır (ücretsiz altyapı maliyetini kontrol altında tutmak için). Kota dolduğunda yeni yükleme yapmadan önce eski parçaları silmeniz gerekir.",
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-16">
      <div>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Ana Sayfa
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Yardım ve Sıkça Sorulan Sorular</h1>
      </div>

      <section className="flex flex-col gap-3 rounded-md bg-gray-50 p-4">
        <h2 className="font-semibold">Hızlı Başlangıç</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>
            <Link href="/upload" className="text-indigo-600 hover:underline">
              Bir şarkı yükleyin
            </Link>{" "}
            (mp3, wav, m4a veya video).
          </li>
          <li>
            Yapay zeka parçayı ayırıp akorlarını/temposunu analiz etsin (birkaç dakika sürebilir).
          </li>
          <li>Oynatıcıda kanalları mikslerin, loop oluşturun, tempo/ton değiştirin.</li>
          <li>
            Beğendiğiniz şarkıları{" "}
            <Link href="/playlists" className="text-indigo-600 hover:underline">
              çalma listelerine
            </Link>{" "}
            ekleyin.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-6">
        {FAQ.map((item) => (
          <div key={item.q}>
            <h3 className="font-semibold">{item.q}</h3>
            <p className="mt-1 text-sm text-gray-600">{item.a}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
