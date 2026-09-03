# API sözleşmesi

Canonical çalışma zamanı sözleşmesi `apps/api/src/docs/openapi.ts`, dağıtılabilir kopya `apps/api/openapi.yaml` dosyasındadır. Worker `/api/v1/openapi.yaml` adresinden belgeyi sunar.

Tüm korumalı endpoint’ler `Authorization: Bearer <access token>` ister. Finansal mutation ayrıca `Idempotency-Key` ister. Para değerleri JSON number değil string’dir. Tarihler offset içeren ISO-8601 biçimindedir ve sunucuda UTC tutulur.

Başarı dışı cevap biçimi:

```json
{"error":{"code":"VERSION_CONFLICT","message":"...","requestId":"..."}}
```

Liste endpoint’lerinde `items`, sync pull’da `changes/nextCursor/hasMore` kullanılır. API değişikliği geriye uyumsuz olduğunda `/api/v2` açılmalı; mevcut `/api/v1` semantiği sessizce değiştirilmemelidir.

Filtreli rapor endpoint'leri `from`, `to` ve `accountIds` alanlarını ortak kullanır. `accountIds`
verilmezse tüm hesaplar, `none` ise hiçbir hesap, aksi halde virgülle ayrılmış UUID listesi
seçilir. Finansal toplamlar hesap kapsamına göre sunucuda yeniden hesaplanır.

`GET /reports/analytics` bu ortak filtrelere ek olarak `granularity=day|week|month|year` alır ve
rapor veri setini tek tutarlı snapshot olarak döndürür: gelir/gider/net trendi, hesap
bakiye geçmişi, kategori-masraf merkezi-işlem detayı, likidite tahmini, varlık/yatırım
performansı ve varlık karşılaştırma seti (`instrumentComparison`: enstrüman bazlı birim fiyat
serisi + hesap bazlı toplam varlık değeri serisi). Yatırım değerlemesi bitiş tarihinde veya
öncesindeki son kayıtlı fiyatı kullanır.

Piyasa kataloğu ve otomatik fiyat uçları `/investments/market-symbols` ile
`/investments/prices/*` altındadır. Tarih bazlı fiyat listesi eksik veya halka arz öncesi bir gün
için sahte fiyat kaydetmez; sözleşmede `price="0"`, `available=false`, `source="MISSING"` döner.
Manuel güncelleme tek bir kullanıcı aracını değil aktif küresel kataloğun tamamını kuyruğa alır.
