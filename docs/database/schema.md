# Veritabanı şeması

Migration’lar `packages/database/migrations` altında sıralıdır. Değiştirilmiş production migration’ı yerine daima yeni numaralı migration eklenir.

- `001_users`: kullanıcı, credential, dönen refresh token ve cihazlar
- `002_books`: çoklu defter ve OWNER/ADMIN/EDITOR/ACCOUNTANT/VIEWER üyelikleri
- `003_accounts`: tek hesap domain’i; sistem hesapları aynı tabloda hidden flag ile
- `004_categories`: self-reference hiyerarşi ve kategori ledger hesabı
- `005_contacts`: cari bilgiler ve contact/account ilişkisi
- `006_transactions`: immutable posted transaction entries, balance trigger’ları
- `007_scheduling`: upcoming, recurrence templates ve idempotent occurrences
- `008_sync`: request idempotency ve cursor change feed
- `009_audit`: kritik değişiklik izi
- `010_financial_scope_guards`: entry book/currency/deleted-account ve schedule type DB guard’ları
- `011_live_web_and_investments`: canlı web akışları, hesap politikaları ve yatırım tanımları
- `012_scheduled_recurrence_realization`: planlı işlem tekrarları ve gerçekleşme bağlantısı
- `013_investment_sales`: yatırım satış lotları ve satış hareketi bütünlüğü
- `014_cost_centers`: bağımsız masraf merkezleri; işlem ve planlı işlem bağlantıları ile aynı defter guard’ları

Domain tabloları UUID, UTC `TIMESTAMPTZ` ve version alanlarını taşır; finansal
kayıtlar soft-delete/ters kayıt kurallarına tabidir. Masraf merkezlerinde geçmiş
bağlantısı olan kayıt pasife alınır, yalnızca hiç kullanılmamış kayıt fiziksel
olarak silinebilir. Entry tablosu finansal olay olduğu için update metadata’sı
taşımaz ve posted olduktan sonra immutable’dır.

Önemli unique kısıtlar: case-insensitive active user email, active book member, contact/account, `(book_id, client_operation_id)`, `(user_id, idempotency key)` ve recurring occurrence.

Migration çalıştırma:

```bash
npm run db:migrate -- --connection-string postgresql://...
```

Runner `schema_migrations` tablosunu oluşturur, her dosyayı ayrı transaction’da uygular ve uygulanmış dosyayı yeniden çalıştırmaz.

`014_cost_centers.sql` kullanan API sürümü yayınlanmadan önce migration hedef Neon
veritabanına uygulanmalıdır. Dağıtım sırası veritabanı migration'ı, API Worker
health/readiness doğrulaması, web Worker ve son olarak canlı Edge E2E kontrolüdür.
