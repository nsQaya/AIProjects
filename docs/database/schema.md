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
- `015_password_resets`: tek kullanımlık, süreli ve yalnız hash olarak saklanan parola sıfırlama kodları
- `016_market_data_automation`: borsa sembol kataloğu, günlük fiyatlar, bölünme olayları ve senkron çalışmaları
- `017_currency_rates`: para birimi kataloğu, defter bazlı aktif para birimleri ve TCMB günlük kurları
- `018_fractional_share_quantity`: lot ve satış adet hassasiyeti `NUMERIC(24,9)`
- `019_account_types`: defter bazlı özelleştirilebilir hesap türleri; `accounts.account_type_id` FK'ye geçiş
- `020_live_market_prices`: gün içi anlık Yahoo fiyatları için `YAHOO_LIVE` kaynağı
- `021_investment_accounts`: `account_types.is_investment` işareti; "Birikim" türü aracı kurum (yatırım) hesabı olur, birikim alım-satımı yalnızca bu türdeki hesapları hedef alır
- `022_investment_purchase_postings`: `investment_lots.transaction_id`; alım artık aracı kurum hesabından nakit düşen bir ledger işlemi üretir (`SYSTEM_EQUITY` kontra), uygun eski lotlar geriye dönük bağlanır
- `023_capital_increase_lots`: `investment_lots.kind` (`PURCHASE` / `CAPITAL_INCREASE`); bedelsiz/bedelli sermaye artışı ve elle bölünme özel lot olarak yazılır, `unit_price >= 0`
- `024_multi_currency_postings`: `guard_transaction_entry_scope` gevşetildi; bir işlem artık farklı para birimli hesaplara dokunabilir (döviz alış/satış, dövizli yatırım postlaması), yalnızca `entry.currency_code = account.currency_code` şartı kalır. Denge hâlâ `assert_transaction_balanced` ile `base_amount` (TRY) üzerinden zorunlu. Hesap bakiyesi `amount`'tan (kendi para birimi), defter geneli toplamlar `base_amount` veya güncel kurdan hesaplanır

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

Yeni şema kullanan API sürümü yayınlanmadan önce ilgili migration hedef Neon
veritabanına uygulanmalıdır. Dağıtım sırası veritabanı migration'ı, API Worker
health/readiness doğrulaması, web Worker ve son olarak canlı Edge E2E kontrolüdür.
