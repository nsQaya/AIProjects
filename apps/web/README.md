# DefterX Web

DefterX'in React, strict TypeScript ve Vite ile geliştirilen web istemcisidir. Tek
sayfa uygulaması Cloudflare Worker Static Assets üzerinden sunulur; `/health` ve
`/config.js` isteklerini TypeScript Worker karşılar.

Tarayıcı Neon PostgreSQL'e doğrudan bağlanmaz. Kimlik doğrulama, finansal
mutasyonlar, bakiyeler, yürüyen bakiye ve rapor sonuçları yalnızca DefterX API'den
gelir. İstemci finansal kayıt veya demo bakiye üretmez.

## Teknoloji ve çalışma zamanı

- React ve React DOM
- Strict TypeScript
- Vite
- React Router `HashRouter`
- Zod ile kritik API yanıtlarının çalışma zamanı doğrulaması
- Vitest, React Testing Library ve jsdom
- ESLint ve type-aware TypeScript kuralları
- Cloudflare Worker Static Assets ve Wrangler

Worker, production ortamında aşağıdaki herkese açık çalışma zamanı değerlerini
`/config.js` üzerinden `no-store` başlığıyla sağlar:

- `APP_DISPLAY_NAME`
- `APP_ENV`
- `API_BASE_URL`

Yerel Vite sunucusu aynı sözleşmeyi üretir. API adresi gerektiğinde
`apps/web/.env.local` içindeki `DEFTERX_API_BASE_URL` ile değiştirilebilir.

## Dizin yapısı

- `index.html`: Vite HTML giriş noktası
- `src/main.tsx`: React başlangıcı ve çalışma zamanı yapılandırması
- `src/application`: uygulama kabuğu, route bileşimi ve bildirimler
- `src/auth`: oturum sağlayıcısı ile giriş/kayıt ekranı
- `src/components/ui`: ortak buton, dialog, ikon, geri bildirim ve yükleme bileşenleri
- `src/finance`: merkezi finance service, salt-okunur snapshot, DTO görünümleri ve Zod şemaları
- `src/layouts`: masaüstü/mobil uygulama yerleşimi ve navigasyon
- `src/lib`: tarih, para, CSV ve hata yardımcıları
- `src/modules`: hesaplar, işlemler, yaklaşan işlemler, dashboard, raporlar,
  ayarlar ve birikimler
- `src/platform`: API istemcisi, oturum deposu ve runtime config
- `src/providers`: React ile finance service bağlantısı ve mutasyon sonrası canlı yenileme
- `src/styles`: React stil giriş noktası ve paylaşılan ek stiller
- `src/DesignSystem`: görsel uyumluluk için korunan mevcut token ve global CSS
- `src/test`: jsdom test kurulumu
- `worker/index.ts`: Cloudflare Worker giriş noktası
- `scripts/smoke-live.mjs`: production Edge/CDP uçtan uca testi

Aktif tarayıcı giriş zinciri `index.html -> src/main.tsx` biçimindedir. Web
istemcisinde tek uygulama hattı React ve TypeScript kaynaklarından üretilir.

## Rotalar

Mevcut yer imlerini korumak için hash rotaları kullanılmaya devam eder:

- `#/dashboard`
- `#/transactions`
- `#/accounts`
- `#/savings`
- `#/upcoming`
- `#/reports`
- `#/settings`

Kimlik doğrulanmamış kullanıcılar uygulama rotaları yerine giriş/kayıt ekranını
görür. API token yenileme tek uçuşlu merkezi istemcide yapılır; 401 sonrası
yenileme başarısız olursa yerel oturum temizlenir.

## Masraf merkezi ve işlem bütünlüğü

Masraf merkezi, kategoriden bağımsız ve isteğe bağlı ikinci bir işlem kırılımıdır.
Örneğin kategori `Yakıt`, masraf merkezi `Aile arabası`; kategori `Giyim`, masraf
merkezi `Anne` olabilir. Ayarlar ekranından masraf merkezi eklenebilir,
düzenlenebilir ve kullanılmamışsa silinebilir. İşlem veya planlı işlem kaydı
bulunan bir masraf merkezi silinmek yerine pasife alınır; geçmiş işlemler ve
raporlar pasif kaydın adını göstermeye devam eder.

Masraf merkezi gider ve planlı gider formlarında seçilebilir. İşlem defterinde
masraf merkezi filtresi ve sütunu bulunur; CSV dışa aktarımı bu kırılımı içerir.
Gelir-gider raporu, kategori sonucundan ayrı bir masraf merkezi dağılımı sunar.

İşlem silme finansal kaydı fiziksel olarak kaldırmaz; ters kayıt üretir ve işlem
defterindeki modern uygulama içi onay penceresinden yürütülür. Gerçekleşmiş bir
planın ürettiği işlem ters kayda alındığında bağlı planın gerçekleşme bağlantısı
temizlenir ve tarihine göre yeniden bekliyor/gecikmiş duruma açılır. İşlem
düzeltmesinde ise plan tamamlanmış kalır ve bağlantı düzeltilmiş yeni işleme
atomik olarak taşınır.

## Yerel geliştirme

Repo kökünden:

```bash
npm install
npm run web:dev
```

Vite varsayılan olarak `http://127.0.0.1:3000` adresinde açılır. API Worker ayrı
çalıştırılacaksa repo kökünde başka bir terminalden `npm run dev` kullanılabilir.

Production bundle'ını yerelde incelemek için:

```bash
npm run build:app --workspace @defterx/web
npm run preview --workspace @defterx/web
```

## Kontroller

```bash
npm run check --workspace @defterx/web
npm run build --workspace @defterx/web
```

`check`; strict typecheck, ESLint ve component/unit testlerini çalıştırır. `build`;
Vite production bundle'ını üretir, ardından Wrangler dry-run ile Worker ve asset
binding'lerini doğrular. Yalnızca Vite çıktısı için `build:app` kullanılabilir.

Canlı smoke testi production ortamını ve tarayıcıyı etkilediğinden izole test
kullanıcısıyla çalıştırılmalıdır. 2026-08-11 kapanışında tam Edge/CDP paketi canlı
Worker üzerinde başarıyla geçmiştir:

```bash
npm run smoke:live --workspace @defterx/web -- https://defterx-web.agentproje1.workers.dev
```

## Cloudflare dağıtımı

`wrangler.jsonc`, `dist` klasörünü Static Assets binding'iyle sunar ve SPA
fallback'ini etkinleştirir. Dağıtımdan önce `API_BASE_URL` ile API Worker
`ALLOWED_ORIGINS` değerlerinin hedef originlerle uyumlu olduğu doğrulanmalıdır.

Masraf merkezi desteği `packages/database/migrations/014_cost_centers.sql`
migration'ına bağlıdır. Bu sürüm için dağıtım sırası şöyledir:

1. Neon PostgreSQL üzerinde tüm migration'ları, özellikle `014_cost_centers.sql`
   dosyasını uygula.
2. API Worker'ı dağıt; `/health`, readiness ve veritabanı destekli masraf merkezi
   smoke kontrollerini doğrula.
3. Web Worker'ı dağıt.
4. İşlem, planlı işlem, rapor ve ters kayıt akışlarını production Edge E2E ile
   yeniden doğrula.

API, 014 ile eklenen tablo ve sütunları kullandığı için migration'dan önce
dağıtılmamalıdır. Sürüm dağıtımlarında bu sıra korunmalıdır.

2026-08-11 production dağıtımında Neon migration seviyesi 14 doğrulandı; API
Worker `4f6ddb98-ee41-4928-bfff-c9bb3d37a705`, web Worker ise
`316f5ecd-ec12-4c16-807d-b774317cbb67` sürümüyle yayınlandı. Canlı API smoke ve
tam Edge/CDP parity paketi geçti.

```bash
npm run deploy:web
```

Geçişin kapanış sonuçları için
[`docs/migrations/react-migration-completion-report.md`](../../docs/migrations/react-migration-completion-report.md),
aşama kaydı için
[`docs/migrations/react-migration-progress.md`](../../docs/migrations/react-migration-progress.md)
dosyasına bakın.
