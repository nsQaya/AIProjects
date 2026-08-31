import { isAPIError } from "../platform/api/api-error";

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "E-posta veya parola hatalı.",
  INVALID_CURRENT_PASSWORD: "Mevcut şifreniz hatalı.",
  INVALID_PASSWORD_RESET_TOKEN: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
  PASSWORD_RESET_TOKEN_INVALID: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
  PASSWORD_RESET_EMAIL_UNAVAILABLE:
    "Şifre sıfırlama e-postası şu anda gönderilemiyor. Lütfen daha sonra tekrar deneyin.",
  PASSWORD_UNCHANGED: "Yeni şifreniz mevcut şifrenizden farklı olmalıdır.",
  EMAIL_EXISTS: "Bu e-posta zaten kayıtlı.",
  NEGATIVE_BALANCE_NOT_ALLOWED: "Bu hesap eksi bakiyeye düşemez.",
  ACCOUNT_LIMIT_EXCEEDED: "Hesap limiti aşılıyor.",
  ACCOUNT_LIMIT_CONFLICT: "Güncel bakiye seçilen hesap limitini aşıyor.",
  CREDIT_LIMIT_REQUIRES_OVERDRAFT: "Limit tanımlamak için eksi bakiyeye izin verin.",
  ACCOUNT_TYPE_BALANCE_CONFLICT:
    "Bakiyesi olan bu hesabın türü borç/varlık yönünü değiştiremez.",
  RECURRENCE_TOO_LONG: "Tek seferde en fazla 240 tekrar oluşturulabilir.",
  CATEGORY_INVALID: "Kategori artık kullanılamıyor; etkin bir kategori seçin.",
  LEDGER_MAPPING_MISSING: "Gelir/gider işlemleri için bir kategori seçmelisiniz.",
  INVESTMENT_QUANTITY_EXCEEDED: "Satış adedi eldeki birikim adedini aşıyor.",
  INVESTMENT_HISTORY_LOCKED:
    "Satış yapılmış bir yatırımın eski alım lotları değiştirilemez; düzeltme lotu ekleyin.",
  ACCOUNT_NOT_INVESTMENT: "Bu hesap bir aracı kurum / yatırım hesabı değil.",
  INVESTMENT_CURRENCY_MISMATCH:
    "Yatırım aracı ile aracı kurum hesabı aynı para biriminde olmalı.",
  INVESTMENT_SALE_CURRENCY_MISMATCH:
    "Satış bedelinin geçtiği hesap, yatırım aracıyla aynı para biriminde olmalı.",
  CURRENCY_RATE_MISSING:
    "Bu para birimi için güncel kur henüz alınmadı; Ayarlar’dan kurları güncelleyin.",
  CURRENCY_NOT_ENABLED:
    "Bu para birimini önce Ayarlar’dan defter için etkinleştirin.",
  FX_REQUIRES_BASE_LEG: "Döviz dönüşümünün bir tarafı TL hesabı olmalı.",
  FX_SAME_CURRENCY: "İki hesap da aynı para biriminde; döviz dönüşümü gerekmez.",
  FX_SAME_ACCOUNT: "Kaynak ve hedef hesap farklı olmalı.",
  CAPITAL_INCREASE_NOT_POSITIVE: "Yeni toplam adet mevcut açık pozisyondan büyük olmalı.",
  ACCOUNT_REQUIRED_FOR_PAID_INCREASE:
    "Bedelli sermaye artışında ödemenin çıktığı aracı kurum hesabı seçilmeli.",
  CAPITAL_INCREASE_IMMUTABLE: "Sermaye artırımı kaydı düzenlenemez; silip yeniden ekleyin.",
  VERSION_CONFLICT: "Kayıt başka bir yerde değişti; canlı veriler yenilenmeli.",
  NETWORK_ERROR: "Canlı API'ye ulaşılamadı.",
  API_NOT_CONFIGURED: "Canlı API adresi tanımlı değil.",
  INVALID_API_RESPONSE: "Canlı API beklenmeyen bir yanıt verdi.",
};

const fieldNames: Record<string, string> = {
  bookId: "Defter",
  instrumentId: "Yatırım aracı",
  destinationAccountId: "Hedef hesap",
  targetAccountId: "Hedef hesap",
  accountId: "Hesap",
  categoryId: "Kategori",
  quantity: "Adet",
  unitPrice: "Fiyat",
  amount: "Tutar",
  soldAt: "Tarih",
  scheduledAt: "Tarih",
  clientOperationId: "İşlem kimliği",
};

function validationFields(details: unknown): string[] {
  if (typeof details !== "object" || details === null || !("fieldErrors" in details)) return [];
  const fieldErrors = details.fieldErrors;
  if (typeof fieldErrors !== "object" || fieldErrors === null) return [];

  return Object.entries(fieldErrors)
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .map(([field]) => fieldNames[field] ?? field);
}

export function errorMessage(error: unknown): string {
  if (!isAPIError(error)) {
    return error instanceof Error ? error.message : "İşlem tamamlanamadı.";
  }

  if (error.code === "VALIDATION_ERROR") {
    const fields = validationFields(error.details);
    if (fields.length > 0) return `Geçersiz veya eksik alan: ${fields.join(", ")}.`;
  }

  return messages[error.code] ?? error.message ?? "İşlem tamamlanamadı.";
}
