# DefterX

DefterX; kişisel gelir-gider, planlı işlem, hesap ve yatırım takibini çift taraflı kayıt esaslı finans çekirdeği üzerinde birleştiren bir uygulamadır.

Web istemcisi **React + strict TypeScript + Vite**, API ise **TypeScript + Hono + Cloudflare Workers** kullanır. Tarayıcı veritabanına doğrudan bağlanmaz:

```text
Browser → Cloudflare Web Worker → Cloudflare API Worker → Hyperdrive → Neon PostgreSQL
```

## Repository yapısı

- `apps/web`: React web istemcisi, Vite build'i ve Cloudflare Static Assets Worker
- `apps/api`: Hono REST API ve Cloudflare Worker yapılandırması
- `apps/ios`: SwiftUI, GRDB, offline operation queue ve background sync içeren iOS istemcisi
- `packages/contracts`: web ve API arasında paylaşılan public DTO/sözleşmeler
- `packages/database`: PostgreSQL migration ve seed dosyaları
- `packages/shared`: ortak para ve doğrulama yardımcıları
- `infra/cloudflare`: Cloudflare kaynakları ve yayınlama notları
- `docs`: mimari, ürün ve migration belgeleri

## Yerel kurulum

Gereksinimler: Node.js 22+, npm, Wrangler 4+; yerel API/veritabanı geliştirmesi için PostgreSQL 16+.

```bash
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
npm run db:migrate -- --connection-string postgresql://postgres:postgres@localhost:5432/defterx
```

API Worker'ı çalıştırmak için:

```bash
npm run dev
```

React web istemcisini ayrı bir terminalde çalıştırmak için:

```bash
npm run web:dev
```

Vite varsayılan olarak `http://127.0.0.1:3000` adresini kullanır. Geliştirme API adresi `DEFTERX_API_BASE_URL` ile değiştirilebilir; belirtilmezse `apps/web/vite.config.ts` içindeki güvenli varsayılan kullanılır. Bu değer public runtime config'e dönüşür, secret olmamalıdır.

PowerShell örneği:

```powershell
$env:DEFTERX_API_BASE_URL = "http://127.0.0.1:8787"
npm run web:dev
```

## Ortam değişkenleri ve secret'lar

API için `JWT_SECRET` ve `REFRESH_TOKEN_PEPPER` yalnızca Wrangler secret olarak tutulmalıdır. PostgreSQL bağlantı bilgisi production'da `HYPERDRIVE` binding'i üzerinden gelir; frontend bundle'ına veritabanı kimlik bilgisi veya başka bir secret konulmaz.

Web Worker çalışma zamanı değerleri `apps/web/wrangler.jsonc` içindeki `APP_DISPLAY_NAME`, `APP_ENV` ve `API_BASE_URL` değişkenleridir. Worker `/config.js` yanıtını `no-store` ile üretir. API tarafındaki `ALLOWED_ORIGINS`, yayınlanan web origin'ini açıkça içermelidir.

## Kontroller ve build

```bash
npm run check       # tüm workspace typecheck'leri + web lint/test
npm test            # API ve web testleri
npm run build       # contracts/shared/API/web production build
```

PostgreSQL entegrasyon testleri `TEST_DATABASE_URL` ile etkinleşir. Değişken yoksa dış veritabanı isteyen test grubu atlanır; unit ve HTTP testleri çalışmaya devam eder.

Web'e özel komutlar:

```bash
npm run typecheck --workspace @defterx/web
npm run test --workspace @defterx/web
npm run preview --workspace @defterx/web
```

## Cloudflare deployment

Önerilen sıra: migration'ları kontrollü çalıştır, API'yi yayınla ve health/smoke testini doğrula, ardından web Worker'ını yayınla.

```bash
npm run deploy:api
npm run deploy:web
```

API `/api/v1` altında versiyonlanır; health endpoint'i `/health`, OpenAPI belgesi `/api/v1/openapi.yaml` adresindedir. Web Worker, Vite `dist` varlıklarını sunar ve SPA fallback ile doğrudan/yenilenen route'ları destekler.

Cloudflare binding'leri ve operasyon ayrıntıları için [Cloudflare notlarına](infra/cloudflare/README.md), tamamlanan React geçişinin doğrulama ve dağıtım kaydı için [migration kapanış raporuna](docs/migrations/react-migration-completion-report.md) bakın.

## iOS

`apps/ios` dizinini Xcode ile açın. Geliştirme API adresi scheme/configuration üzerinden ayarlanır. GRDB bağımlılığı Swift Package Manager tarafından çözülür; Face ID ve background task ayarları iOS projesinin README/configuration dosyalarında açıklanır.
