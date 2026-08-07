# V3 yol haritası

- Inventory items, warehouses ve stock movements
- Personel, notlar ve görevler
- Advanced accounting mode ve özelleştirilebilir chart of accounts
- Konsolidasyon ve ileri finansal raporlar
- Otomatik banka feed’i ve gelişmiş mutabakat

Stok hareketleri finans ledger’ına doğrudan tablo paylaşımıyla bağlanmamalı; açık bir posting use-case’i ile transaction üretmelidir. Yeni bounded context’ler mevcut transaction invariant’larını atlayamaz.

