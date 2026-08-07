# DefterX Web

Cloudflare Worker Static Assets üzerinde çalışan DefterX web istemcisidir. Yapı iOS
istemcisindeki katmanları takip eder:

- `src/App`: uygulama başlangıcı, dependency container ve router
- `src/Core`: ortak formatlama ve güvenlik yardımcıları
- `src/Data`: repository implementasyonları ve demo veri kaynağı
- `src/DesignSystem`: tasarım tokenları, stiller ve ikonlar
- `src/Domain`: modeller ve repository sözleşmeleri
- `src/Features`: ekran bazlı modüller
- `src/Networking`: API istemcisi
- `src/Persistence`: tarayıcı kalıcılığı
- `src/Resources`: çalışma zamanı yapılandırması
- `src/Sync`: API senkronizasyon orkestrasyonu
- `worker`: Cloudflare Worker giriş noktası

Yerelde çalıştırmak için repo kökünden `npm run web:dev`, Cloudflare'a göndermek için
`npm run deploy:web` kullanılır. Production deploy öncesi `wrangler.jsonc` içindeki
`API_BASE_URL` ve API Worker içindeki `ALLOWED_ORIGINS` gerçek domainlerle değiştirilmelidir.
