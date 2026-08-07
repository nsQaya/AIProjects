# V1 tamamlanma raporu

Tarih: 2026-08-07

## Yapılanlar

- TypeScript/Hono Cloudflare Worker, Hyperdrive/pg, R2 ve Queue binding’leri
- Authentication, PBKDF2 password hash, kısa access JWT ve refresh rotation/reuse detection
- Çoklu/paylaşılan defter ve beş seviyeli server-side authorization
- Hesap, hidden kategori hesabı, contact/cari hesabı
- Dengeli ledger mapper, PostgreSQL deferred invariant, immutable entries ve reversal
- Idempotency-Key, client operation unique kısıtı, audit ve sync change feed
- Scheduled/recurring işlemler; occurrence unique kısıtı ve queue consumer
- Dashboard, gelir/gider, bakiye, borç/alacak ve cari ekstre sorguları
- SwiftUI/GRDB offline operation queue, referans cache, Keychain, biometric lock, background sync, hızlı işlem ve PDF export
- OpenAPI, migration runner, unit ve koşullu PostgreSQL integration testleri

## Doğrulananlar

- `npm run check`: başarılı
- `npm test`: 19 başarılı; `TEST_DATABASE_URL` bulunmadığı için 5 PostgreSQL integration testi atlandı
- `npm run build`: Wrangler dry-run başarılı
- Worker bundle: yaklaşık 958 KiB, gzip yaklaşık 161 KiB
- `npm audit --omit=dev`: 0 production açığı. Tam audit, Wrangler/Miniflare geliştirme zincirindeki Undici için upstream fix bulunmayan 2 moderate + 1 high kayıt bildiriyor; runtime Worker bundle dependency’si değildir.

## Ortam nedeniyle doğrulanamayanlar

- Bu Windows ortamında PostgreSQL test veritabanı sağlanmadığı için migration’ların gerçek PostgreSQL 16 üzerinde sıfırdan uygulanması ve beş DB integration testi çalıştırılamadı.
- Swift/Xcode/XcodeGen kurulu olmadığı için iOS target ve iki XCTest burada derlenemedi. macOS CI doğrulaması release kapısı olmalıdır.
- Gerçek Cloudflare account id, Hyperdrive id, Queue/R2 ve production secrets sağlanmadığı için remote deployment/smoke test yapılmadı; dry-run deploy başarılıdır.

Bu üç madde tamamlanmadan artefact “production doğrulaması tamamlandı” olarak işaretlenmemelidir.

## Bilinen teknik borçlar

- V1 OpenAPI dosyası endpoint gruplarını kapsar; her response alanı için code-generated istemci sağlayacak kadar ayrıntılı değildir.
- Rate Limiting binding Wrangler’da 10 request/60 seconds olarak tanımlıdır; namespace id’nin hesap içindeki benzersizliği deployment sırasında doğrulanmalıdır.
- Dashboard’ın local offline aggregate cache’i yoktur; offline iken son işlem listesi çalışır, sunucu aggregate kartları son başarılı değeri cache’leyecek şekilde genişletilebilir.
- Refresh token family güvenlik olayları için ayrı alarm/telemetri kurulmalıdır.
- Attachment binding hazırdır ancak V1’de endpoint yoktur.

## V2 migration ihtiyaçları

Exchange rates, transaction posting-rate reference, attachments/R2 object metadata, custom permission grants ve reconciliation session tabloları yeni migration’lar olarak eklenmelidir. `NUMERIC(24,12)` kur precision’ı kullanılmalı; eski `base_amount` yeniden hesaplanmamalıdır.

## Deployment notları

Önce yedekli PostgreSQL ve migration CI, sonra Hyperdrive preview smoke testi, Queue/R2 ve Rate Limiting binding’leri, son olarak secrets ve Worker deploy uygulanır. iOS release öncesi gerçek cihazda Face ID, uçak modunda create/relaunch, token rotation, duplicate retry, background sync ve PDF share testleri zorunludur.
