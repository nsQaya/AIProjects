-- Aşama 3: bedelli / bedelsiz sermaye artışı ve elle bölünme. Bir sermaye artışı
-- "N adet payı C liraya edinmek"tir (bedelsizde C=0), yani özel bir alım lotu.
-- Bedelsiz lotun birim fiyatı 0 olduğu için unit_price kısıtı gevşetilir; kind
-- kolonu alımı sermaye artışından ayırır.

-- unit_price > 0 -> unit_price >= 0 (kısıt adı satır içi tanımdan otomatik geldiği
-- için dinamik bulunur; bkz. 020_live_market_prices.sql).
DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'investment_lots'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%unit_price%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE investment_lots DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE investment_lots
  ADD CONSTRAINT investment_lots_unit_price_nonnegative CHECK (unit_price >= 0);

ALTER TABLE investment_lots
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'PURCHASE'
    CHECK (kind IN ('PURCHASE','CAPITAL_INCREASE'));
