-- The manual "update every price now" button writes an intraday Yahoo quote
-- (meta.regularMarketPrice) stamped on the current day instead of waiting for
-- the official daily close bar. Mark those rows so the UI can label them
-- "anlik" rather than "kapanis".
DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'market_daily_prices'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE market_daily_prices DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE market_daily_prices
  ADD CONSTRAINT market_daily_prices_source_check CHECK (source IN ('YAHOO','YAHOO_LIVE'));
