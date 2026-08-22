/**
 * Ajan 12 Kritik #1: apps/ai-service artık `AI_SERVICE_INTERNAL_KEY`
 * paylaşımlı sırrını bilmeyen çağrıları reddediyor (bkz.
 * apps/ai-service/app/security.py). apps/api'nin ai-service'e yaptığı her
 * çağrı bu header'ı taşımak zorunda; env değişkeni eksikse çağrı yapılmadan
 * önce anlamlı bir hatayla durdurulur (ai-service'ten sessizce 401 almak
 * yerine).
 */
export function buildAiServiceHeaders(): Record<string, string> {
  const key = process.env.AI_SERVICE_INTERNAL_KEY;
  if (!key) {
    throw new Error('AI_SERVICE_INTERNAL_KEY is not configured');
  }

  return {
    'Content-Type': 'application/json',
    'X-Internal-Service-Key': key,
  };
}
