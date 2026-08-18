CREATE TABLE market_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_provider TEXT NOT NULL DEFAULT 'YAHOO' CHECK (price_provider IN ('YAHOO')),
  catalog_source TEXT NOT NULL CHECK (catalog_source IN ('NASDAQ_TRADER','KAP')),
  provider_symbol TEXT NOT NULL CHECK (char_length(provider_symbol) BETWEEN 1 AND 40),
  exchange_code TEXT NOT NULL CHECK (char_length(exchange_code) BETWEEN 1 AND 20),
  market TEXT NOT NULL CHECK (market IN ('US','BIST')),
  instrument_type TEXT NOT NULL CHECK (instrument_type IN ('EQUITY','ETF','FUND','OTHER')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 240),
  currency_code CHAR(3) NOT NULL,
  first_trade_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(price_provider,provider_symbol)
);

CREATE INDEX market_symbols_search_idx
  ON market_symbols(market,provider_symbol,name) WHERE is_active=true;

CREATE TABLE market_daily_prices (
  market_symbol_id UUID NOT NULL REFERENCES market_symbols(id),
  price_date DATE NOT NULL,
  close NUMERIC(20,6) NOT NULL CHECK (close > 0),
  adjusted_close NUMERIC(20,6) CHECK (adjusted_close IS NULL OR adjusted_close > 0),
  currency_code CHAR(3) NOT NULL,
  source TEXT NOT NULL DEFAULT 'YAHOO' CHECK (source IN ('YAHOO')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(market_symbol_id,price_date)
);

CREATE INDEX market_daily_prices_date_idx ON market_daily_prices(price_date,market_symbol_id);

CREATE TABLE market_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_symbol_id UUID NOT NULL REFERENCES market_symbols(id),
  split_date DATE NOT NULL,
  numerator NUMERIC(20,8) NOT NULL CHECK (numerator > 0),
  denominator NUMERIC(20,8) NOT NULL CHECK (denominator > 0),
  source TEXT NOT NULL DEFAULT 'YAHOO' CHECK (source IN ('YAHOO')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(market_symbol_id,split_date,numerator,denominator)
);

ALTER TABLE investment_instruments
  ADD COLUMN market_symbol_id UUID REFERENCES market_symbols(id);

CREATE INDEX investment_instruments_market_symbol_idx
  ON investment_instruments(market_symbol_id) WHERE market_symbol_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE investment_split_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  instrument_id UUID NOT NULL REFERENCES investment_instruments(id),
  market_split_id UUID NOT NULL REFERENCES market_splits(id),
  affected_lots INTEGER NOT NULL DEFAULT 0,
  affected_sales INTEGER NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instrument_id,market_split_id)
);

CREATE TABLE market_data_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('CATALOG','PRICES','SPLITS')),
  target_date DATE,
  trigger TEXT NOT NULL CHECK (trigger IN ('SCHEDULED','MANUAL','DEPLOY')),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED')),
  requested_by_user_id UUID REFERENCES users(id),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  updated_items INTEGER NOT NULL DEFAULT 0,
  missing_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX market_data_sync_runs_lookup_idx
  ON market_data_sync_runs(kind,target_date,created_at DESC);

CREATE TABLE market_data_sync_batches (
  run_id UUID NOT NULL REFERENCES market_data_sync_runs(id) ON DELETE CASCADE,
  batch_key TEXT NOT NULL,
  processed_items INTEGER NOT NULL,
  updated_items INTEGER NOT NULL,
  missing_items INTEGER NOT NULL,
  failed_items INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id,batch_key)
);
