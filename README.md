# DefterX

DefterX, kişisel gelir-gider takibi ile küçük işletme cari takibini aynı sade arayüzde birleştiren, çift taraflı kayıt esaslı bir finans uygulamasıdır. Ürün adı çalışma adıdır; istemcilerde `APP_DISPLAY_NAME`, iOS yapılandırmasında ise bundle display name üzerinden değiştirilebilir.

## Yapı

- `apps/api`: Cloudflare Workers üzerinde Hono REST API
- `apps/web`: Cloudflare Worker Static Assets üzerinde çalışan modüler web istemcisi
- `apps/ios`: SwiftUI, GRDB, offline operation queue ve background sync içeren iOS istemcisi
- `packages/contracts`: API ve domain sözleşmeleri
- `packages/database`: PostgreSQL migration ve seed dosyaları
- `packages/shared`: parasal değer doğrulama araçları
- `infra/cloudflare`: Cloudflare kurulum notları
- `docs`: mimari, API, veri modeli ve ürün kapsamı

## Yerel kurulum

Gereksinimler: Node.js 22+, PostgreSQL 16+, Wrangler 4+, iOS için macOS/Xcode 16+.

```bash
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
npm run db:migrate -- --connection-string postgresql://postgres:postgres@localhost:5432/defterx
npm run dev
```

Web istemcisini Cloudflare yerel runtime ile açmak için ayrı bir terminalde:

```bash
npm run web:dev
```

Web Worker varsayılan olarak `http://127.0.0.1:3000` adresinde çalışır. Port doluysa
Wrangler komutuna farklı bir `--port` değeri verilebilir.

Migration komutu `DATABASE_URL` ortam değişkenini de kabul eder. Sıfır veritabanında dosyaları ada göre tek transaction içinde uygular ve `schema_migrations` tablosuyla geçmişi korur.

## PostgreSQL ve Hyperdrive

Önce PostgreSQL veritabanını ve TLS erişimini hazırlayın. Ardından `wrangler hyperdrive create defterx-postgres --connection-string=...` komutunun döndürdüğü id'yi `apps/api/wrangler.jsonc` içindeki `hyperdrive[].id` alanına yazın. Worker kodu yalnızca `HYPERDRIVE.connectionString` kullanır; production bağlantı bilgisi kaynak kodda tutulmaz.

## Secrets ve Cloudflare

```bash
cd apps/api
npx wrangler secret put JWT_SECRET
npx wrangler secret put REFRESH_TOKEN_PEPPER
npx wrangler deploy
```

`ALLOWED_ORIGINS` değişkenini virgülle ayrılmış kesin origin listesi olarak ayarlayın. R2 ve Queue binding'leri yapılandırmada hazırdır. Rate Limiting binding production ortamında Cloudflare paneli/Wrangler üzerinden bağlanır. Ayrıntılar `infra/cloudflare/README.md` içindedir.

## iOS

`apps/ios` dizinini Xcode ile Swift Package olarak açın. `DefterX/Resources/Configuration.swift` içindeki geliştirme API adresini scheme configuration ile değiştirin. GRDB bağımlılığı Swift Package Manager tarafından çözülür. Face ID kullanımı için üreten Xcode hedefinin `Info.plist` dosyasına `NSFaceIDUsageDescription` ekleyin. BackgroundTasks identifier: `com.example.defterx.sync`.

## Kontroller

```bash
npm run check
npm test
npm run build
```

PostgreSQL integration testleri için `TEST_DATABASE_URL` ayarlanır. Değişken yoksa yalnızca dış veritabanı isteyen test grubu atlanır; saf domain ve HTTP testleri çalışmaya devam eder.

## API

API `/api/v1` altında versiyonlanır. OpenAPI belgesi `apps/api/openapi.yaml` ve çalışma zamanında `/api/v1/openapi.yaml` adresindedir. Health endpoint'i `/health` adresindedir.

Deployment, güvenlik ve operasyonel sınırlamalar için [Cloudflare notları](infra/cloudflare/README.md) ile [V1 tamamlanma raporuna](docs/product/v1-completion-report.md) bakın.
