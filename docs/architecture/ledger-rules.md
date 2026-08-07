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

Para API’de decimal string, PostgreSQL’de `NUMERIC(20,6)` olarak taşınır. JavaScript `Number`, Swift `Double` finansal hesaplarda kullanılmaz. V1’de `base_amount = amount`; ileride posting anındaki sabit kur ile hesaplanacaktır.

`account.balance` yoktur. Bakiye posted ve reversed tarihçedeki entry’lerden, hesabın normal balance yönüne göre yeniden kurulur. Reversal, orijinal entry’lerin yönünü tersine çeviren yeni posted işlem oluşturur; orijinal `REVERSED` olur fakat entry’leri değişmez.

### Savunma katmanları

1. Zod para ve alan doğrulaması.
2. Domain mapper’ın gerekli kategori/cari/hedef hesap kontrolleri.
3. `Money` ile in-memory debit/credit eşitlik kontrolü.
4. Parametreli SQL ve tek DB transaction’ı.
5. Deferred PostgreSQL balance constraint trigger’ı.
6. Posted entry update/delete engelleyen trigger.

