# Ledger kuralları

Kullanıcı muhasebe terimlerini görmez. API aşağıdaki iş akışlarını dengeli entry çiftlerine çevirir:

| Kullanıcı işlemi | Debit | Credit |
|---|---|---|
| Gelir | Kasa/banka | Kategoriye ait hidden gelir hesabı |
| Gider | Kategoriye ait hidden gider hesabı | Kasa/banka |
| Transfer | Hedef hesap | Kaynak hesap |
| Cari satış | Müşteri hesabı | Gelir kategorisi hesabı |
| Cari alış | Gider kategorisi hesabı | Tedarikçi hesabı |
| Tahsilat | Kasa/banka | Müşteri hesabı |
| Ödeme | Tedarikçi hesabı | Kasa/banka |
| Açılış | Kullanıcı hesabı | Hidden equity hesabı |
| Birikim alımı | Para birimine ait hidden equity hesabı | Aracı kurum (yatırım) hesabı |
| Bedelli sermaye artışı | Para birimine ait hidden equity hesabı | Aracı kurum (yatırım) hesabı |
| Birikim satışı | Aracı kurum (yatırım) hesabı | Para birimine ait hidden equity hesabı |
| Döviz alışı | Döviz hesabı | TL hesabı |
| Döviz satışı | TL hesabı | Döviz hesabı |

Para API’de decimal string, PostgreSQL’de `NUMERIC(20,6)` olarak taşınır. JavaScript `Number`, Swift `Double` finansal hesaplarda kullanılmaz.

`amount` hesabın kendi para birimindeki tutardır; `base_amount` defter baz para birimi (TRY) karşılığıdır (posting anındaki kur ile). Tek para birimli işlemde ikisi eşittir. Çift para birimli bir işlem (döviz alış/satış, dövizli yatırım) `assert_transaction_balanced` ile yalnızca `base_amount` üzerinden dengelenir; her entry’nin `currency_code`’u kendi hesabının para birimine eşit olmalıdır.

Açılış bakiyesi tek bir `OPENING_BALANCE` işlemidir ve sonradan düzenlenebilir:
`PATCH /accounts/:id` `openingBalance` alanı verildiğinde mevcut açılış işlemi ters
kaydedilir (limit kontrolü ters kayıtta uygulanmaz) ve yeni tutarla, orijinal tarihiyle
yeniden postlanır; yeni postlama normal bakiye kuralından geçer, dolayısıyla hesaptan
harcanandan düşük bir açılış tutarı `NEGATIVE_BALANCE_NOT_ALLOWED` ile reddedilir ve
güncelleme geri alınır. `"0"` açılış kaydını kaldırır.

`account.balance` yoktur. Bakiye posted ve reversed tarihçedeki entry’lerden, hesabın kendi para biriminde (`amount`), normal balance yönüne göre yeniden kurulur. Net varlık gibi defter geneli toplamlar dövizli hesapları güncel TCMB kuruyla TL’ye çevirir. Reversal, orijinal entry’lerin yönünü tersine çeviren yeni posted işlem oluşturur; orijinal `REVERSED` olur fakat entry’leri değişmez.

### Savunma katmanları

1. Zod para ve alan doğrulaması.
2. Domain mapper’ın gerekli kategori/cari/hedef hesap kontrolleri.
3. `Money` ile in-memory debit/credit eşitlik kontrolü.
4. Parametreli SQL ve tek DB transaction’ı.
5. Deferred PostgreSQL balance constraint trigger’ı.
6. Posted entry update/delete engelleyen trigger.

