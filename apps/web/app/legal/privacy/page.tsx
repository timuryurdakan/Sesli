export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 prose">
      <h1>Gizlilik Politikası</h1>

      <p>
        Bu belge taslak niteliğindedir ve hukuki tavsiye yerine geçmez; ticarileşme öncesi KVKK ve
        (ilgiliyse) GDPR uyumluluğu için bir hukuk danışmanından görüş alınması önerilir.
      </p>

      <h2>1. Toplanan Veriler</h2>
      <p>
        Ad, e-posta, enstrüman tercihi, yüklediğiniz ses/video dosyaları ve bunlardan üretilen
        analiz sonuçları (akor, tempo, stem&apos;ler).
      </p>

      <h2>2. Verilerin Kullanımı</h2>
      <p>
        Verileriniz yalnızca platformun temel işlevlerini (ses ayırma, akor/tempo analizi, senkron
        pratik) sunmak için kullanılır; üçüncü taraflarla paylaşılmaz veya satılmaz.
      </p>

      <h2>3. Unutulma Hakkı</h2>
      <p>
        Hesap ayarları sayfasından hesap silme talebinde bulunduğunuzda; profil bilgileriniz,
        yüklediğiniz dosyalar ve bunlardan üretilen tüm türev veriler makul bir süre içinde kalıcı
        olarak silinir.
      </p>

      <h2>4. Veri Güvenliği</h2>
      <p>
        Veritabanı erişimi Row Level Security (RLS) ile satır bazında kısıtlanmıştır; her kullanıcı
        yalnızca kendi verisine erişebilir.
      </p>
    </main>
  );
}
