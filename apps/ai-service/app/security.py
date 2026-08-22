import hmac
import os

from fastapi import Header, HTTPException, status


def verify_internal_key(x_internal_service_key: str | None = Header(default=None)) -> None:
    """
    Ajan 12 (Güvenlik Denetçisi) Kritik #1: ai-service, service-role Supabase
    anahtarına sahip ve hiçbir kimlik doğrulaması olmadan keyfi storagePath
    okuyup pahalı Demucs/SoundTouch/librosa işleri tetikleyebiliyordu. Bu
    servise yalnızca apps/api'nin (paylaşılan bir sırrı bilen) erişebildiğini
    garanti eder; apps/api'deki tüm IDOR/sahiplik kontrollerinin tek koruma
    katmanı olmaktan çıkmasını sağlar.

    AI_SERVICE_INTERNAL_KEY tanımlı değilse bilinçli olarak "fail closed"
    davranılır (tüm istekler reddedilir) — bu, Supabase/Redis/Sentry gibi
    üçüncü taraf bulut hesabı gerektiren, isteğe bağlı bütünleşmelerden
    farklı olarak, servisler arası erişim kontrolünün kendisidir; sessizce
    devre dışı bırakılırsa tam olarak giderilmeye çalışılan açığı yeniden
    yaratır.
    """
    expected = os.environ.get("AI_SERVICE_INTERNAL_KEY")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI_SERVICE_INTERNAL_KEY is not configured",
        )

    if not x_internal_service_key or not hmac.compare_digest(x_internal_service_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service key",
        )
