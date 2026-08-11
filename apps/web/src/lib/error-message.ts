import { isAPIError } from "../platform/api/api-error";

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "E-posta veya parola hatalı.",
  EMAIL_EXISTS: "Bu e-posta zaten kayıtlı.",
  NEGATIVE_BALANCE_NOT_ALLOWED: "Bu hesap eksi bakiyeye düşemez.",
  ACCOUNT_LIMIT_EXCEEDED: "Hesap limiti aşılıyor.",
  ACCOUNT_LIMIT_CONFLICT: "Güncel bakiye seçilen hesap limitini aşıyor.",
  CREDIT_LIMIT_REQUIRES_OVERDRAFT: "Limit tanımlamak için eksi bakiyeye izin verin.",
  ACCOUNT_TYPE_BALANCE_CONFLICT:
    "Bakiyesi olan bu hesabın türü borç/varlık yönünü değiştiremez.",
  RECURRENCE_TOO_LONG: "Tek seferde en fazla 240 tekrar oluşturulabilir.",
  CATEGORY_INVALID: "Kategori artık kullanılamıyor; etkin bir kategori seçin.",
  INVESTMENT_QUANTITY_EXCEEDED: "Satış adedi eldeki birikim adedini aşıyor.",
  INVESTMENT_HISTORY_LOCKED:
    "Satış yapılmış bir yatırımın eski alım lotları değiştirilemez; düzeltme lotu ekleyin.",
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
