# Sistem genel görünümü

DefterX iki yürütme sınırına ayrılır: SwiftUI iOS istemcisi ve Cloudflare Worker API. PostgreSQL finansal tek doğruluk kaynağıdır. iOS SQLite yalnızca offline çalışma kopyası ve gönderim kuyruğudur.

```text
SwiftUI View -> ViewModel -> Repository -> GRDB SQLite
                                  |             |
                                  +-> SyncEngine+-> operation queue
                                         |
                                  URLSession / JSON
                                         |
Cloudflare Worker -> auth + authorization -> use case -> pg/Hyperdrive -> PostgreSQL
                         |                       |
                    rate limiter           audit + sync change
Cloudflare Cron -> Queue -> idempotent recurring processor
R2 (V2 attachment boundary, financial source of truth değil)
```

API route’ları yalnızca HTTP doğrulama ve cevap biçimleme yapar. Finansal işlem türlerinin debit/credit eşlemesi `ledger-mapper.ts`, atomik kayıt akışı `transaction.service.ts`, SQL erişimi repository katmanındadır. Her request’in rolü sunucuda `book_members` üzerinden okunur.

Worker stateless’tir. Access token kısa ömürlü HMAC JWT’dir; refresh token yalnızca hash olarak saklanır ve her kullanımda döndürülür. Secret’lar Worker Secrets üzerinden verilir.

## Hata ve tutarlılık sınırları

- Bir finansal işlem, header + tüm entries + audit + sync change ile tek PostgreSQL transaction’ında commit olur.
- PostgreSQL deferred constraint trigger’ı commit anında posted işlemin en az iki entry içerdiğini ve debit/credit base toplamlarının eşit olduğunu denetler.
- Client payload’ındaki role, bakiye veya ledger entry bilgisi kabul edilmez.
- Metadata version alanları optimistic concurrency içindir. Posted finansal veriler update edilmez; reversal üretilir.
- Queue at-least-once teslim edebilir. `recurring_occurrences(recurring_transaction_id, scheduled_for)` unique kısıtı tekrar üretimi önler.

## Sınırlar

V1 tek para birimli işlem post eder; `currency_code` ve `base_amount` gelecekte exchange-rate servisinin eklenebileceği sınırı korur. V1’de kur çevrimi yapılmaz ve farklı currency hesapları arasında transfer API tarafından iş kuralı olarak genişletilmelidir.

