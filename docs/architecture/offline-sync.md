# Offline sync

iOS’ta bir finansal kayıt oluşturulurken `local_transactions` ve `sync_operations` aynı GRDB write transaction’ında eklenir. Kullanıcıya başarı gösterildiyse gönderilecek operation kaybolamaz. Her operation ve payload içindeki `clientOperationId` aynı UUID’yi kullanır.

```text
PENDING -> SYNCING -> SYNCED
                   -> FAILED -> PENDING/SYNCING (retry)
                   -> CONFLICT (kullanıcı kararı gerekir)
```

`POST /sync/push` her operation için bağımsız sonuç döndürür. Worker hem Idempotency-Key hem `(book_id, client_operation_id)` unique kısıtıyla retry’ı tek finansal kayda indirger. Sunucu başarılı cevabı kaybetse bile aynı operation yeniden gönderilebilir.

Push bittikten sonra istemci cursor ile `GET /sync/pull` çağırır. `sync_changes.sequence` monotonik sunucu cursor’ıdır. Sayfalar bitene kadar çekilir, değişiklikler ve yeni cursor tek local write içinde uygulanır. Sunucu authoritative’dir.

Metadata değişiklikleri `version` ile karşılaştırılır. Version uyuşmazlığı `CONFLICT` olur. Posted transaction için last-write-wins yoktur; düzeltme reversal + yeni transaction’dır.

Referans verileri (books/accounts/categories/contacts) SQLite JSON cache’ine yazılır. Böylece daha önce senkronize olmuş bir defterde uygulama yeniden açıldığında dahi offline işlem formu doldurulabilir. BackgroundTasks best-effort’tür; foreground refresh aynı engine’i çağırır.

