# API sözleşmesi

Canonical çalışma zamanı sözleşmesi `apps/api/src/docs/openapi.ts`, dağıtılabilir kopya `apps/api/openapi.yaml` dosyasındadır. Worker `/api/v1/openapi.yaml` adresinden belgeyi sunar.

Tüm korumalı endpoint’ler `Authorization: Bearer <access token>` ister. Finansal mutation ayrıca `Idempotency-Key` ister. Para değerleri JSON number değil string’dir. Tarihler offset içeren ISO-8601 biçimindedir ve sunucuda UTC tutulur.

Başarı dışı cevap biçimi:

```json
{"error":{"code":"VERSION_CONFLICT","message":"...","requestId":"..."}}
```

Liste endpoint’lerinde `items`, sync pull’da `changes/nextCursor/hasMore` kullanılır. API değişikliği geriye uyumsuz olduğunda `/api/v2` açılmalı; mevcut `/api/v1` semantiği sessizce değiştirilmemelidir.

