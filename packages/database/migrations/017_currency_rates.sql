CREATE TABLE currencies (
  code CHAR(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  name_tr TEXT NOT NULL CHECK (char_length(name_tr) BETWEEN 1 AND 80),
  name_en TEXT NOT NULL CHECK (char_length(name_en) BETWEEN 1 AND 80),
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO currencies(code,name_tr,name_en) VALUES
  ('TRY','TÜRK LİRASI','TURKISH LIRA'),
  ('USD','ABD DOLARI','US DOLLAR'),
  ('AUD','AVUSTRALYA DOLARI','AUSTRALIAN DOLLAR'),
  ('DKK','DANİMARKA KRONU','DANISH KRONE'),
  ('EUR','EURO','EURO'),
  ('GBP','İNGİLİZ STERLİNİ','POUND STERLING'),
  ('CHF','İSVİÇRE FRANGI','SWISS FRANK'),
  ('SEK','İSVEÇ KRONU','SWEDISH KRONA'),
  ('CAD','KANADA DOLARI','CANADIAN DOLLAR'),
  ('KWD','KUVEYT DİNARI','KUWAITI DINAR'),
  ('NOK','NORVEÇ KRONU','NORWEGIAN KRONE'),
  ('SAR','SUUDİ ARABİSTAN RİYALİ','SAUDI RIYAL'),
  ('JPY','JAPON YENİ','JAPANESE YEN'),
  ('RON','RUMEN LEYİ','NEW LEU'),
  ('RUB','RUS RUBLESİ','RUSSIAN ROUBLE'),
  ('CNY','ÇİN YUANI','CHINESE RENMINBI'),
  ('PKR','PAKİSTAN RUPİSİ','PAKISTANI RUPEE'),
  ('QAR','KATAR RİYALİ','QATARI RIAL'),
  ('KRW','GÜNEY KORE WONU','SOUTH KOREAN WON'),
  ('AZN','AZERBAYCAN YENİ MANATI','AZERBAIJANI NEW MANAT'),
  ('AED','BİRLEŞİK ARAP EMİRLİKLERİ DİRHEMİ','UNITED ARAB EMIRATES DIRHAM'),
  ('KZT','KAZAKİSTAN TENGESİ','KAZAKHSTAN TENGE'),
  ('XDR','ÖZEL ÇEKME HAKKI (SDR)','SPECIAL DRAWING RIGHT (SDR)');

CREATE TABLE book_currencies (
  book_id UUID NOT NULL REFERENCES books(id),
  currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(book_id,currency_code)
);

CREATE TABLE currency_daily_rates (
  currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
  rate_date DATE NOT NULL,
  try_rate NUMERIC(20,6) NOT NULL CHECK (try_rate > 0),
  source TEXT NOT NULL DEFAULT 'TCMB' CHECK (source IN ('TCMB')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(currency_code,rate_date)
);

CREATE INDEX currency_daily_rates_date_idx ON currency_daily_rates(rate_date,currency_code);

ALTER TABLE market_data_sync_runs DROP CONSTRAINT market_data_sync_runs_kind_check;
ALTER TABLE market_data_sync_runs ADD CONSTRAINT market_data_sync_runs_kind_check
  CHECK (kind IN ('CATALOG','PRICES','SPLITS','CURRENCY_RATES'));
