# V2 yol haritası

- Exchange-rate tablosu ve posting anındaki immutable rate/base amount
- R2 attachment metadata, signed upload/download ve malware scanning akışı
- XLSX export ve gelişmiş rapor filtreleri
- Custom permission grants; mevcut role enum’u geriye uyumlu kalır
- Reconciliation session ve statement import
- Business profile/fatura üst bilgileri
- Tam web istemcisi

Gerekli yeni migration’lar mevcut tabloları yeniden yazmamalı; exchange rate ve attachment için ayrı tablolar, transaction üzerinde nullable immutable rate reference tercih edilmelidir.

