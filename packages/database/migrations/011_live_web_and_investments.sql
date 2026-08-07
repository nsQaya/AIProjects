ALTER TABLE accounts
  ADD COLUMN allow_negative_balance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN credit_limit NUMERIC(20,6),
  ADD CONSTRAINT accounts_credit_limit_nonnegative CHECK (credit_limit IS NULL OR credit_limit >= 0),
  ADD CONSTRAINT accounts_credit_limit_requires_overdraft CHECK (credit_limit IS NULL OR allow_negative_balance);

UPDATE accounts SET allow_negative_balance=true WHERE account_type='CREDIT_CARD';

ALTER TABLE transactions
  ADD COLUMN account_id UUID REFERENCES accounts(id),
  ADD COLUMN target_account_id UUID REFERENCES accounts(id);

UPDATE transactions t
SET account_id = (
  SELECT e.account_id
  FROM transaction_entries e
  JOIN accounts a ON a.id=e.account_id
  WHERE e.transaction_id=t.id AND a.is_system=false
  ORDER BY CASE
    WHEN t.transaction_type IN ('INCOME','COLLECTION','OPENING_BALANCE') AND e.direction='DEBIT' THEN 0
    WHEN t.transaction_type IN ('EXPENSE','PAYMENT','TRANSFER') AND e.direction='CREDIT' THEN 0
    ELSE 1
  END, e.created_at, e.id
  LIMIT 1
);

UPDATE transactions t
SET target_account_id = (
  SELECT e.account_id
  FROM transaction_entries e
  JOIN accounts a ON a.id=e.account_id
  WHERE e.transaction_id=t.id AND a.is_system=false AND e.direction='DEBIT' AND e.account_id<>t.account_id
  ORDER BY e.created_at,e.id
  LIMIT 1
)
WHERE t.transaction_type='TRANSFER';

CREATE INDEX transactions_source_account_idx ON transactions(account_id,transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX transactions_target_account_idx ON transactions(target_account_id,transaction_date DESC) WHERE target_account_id IS NOT NULL AND deleted_at IS NULL;

CREATE FUNCTION seed_default_categories(target_book UUID, target_currency CHAR(3)) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item RECORD; hidden_account UUID;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('INCOME','Maaş','wallet',10),
      ('INCOME','Ek Gelir','plus-circle',20),
      ('INCOME','Satış','briefcase',30),
      ('INCOME','Faiz / Temettü','trend',40),
      ('EXPENSE','Market','basket',110),
      ('EXPENSE','Kira','home',120),
      ('EXPENSE','Faturalar','receipt',130),
      ('EXPENSE','Ulaşım','car',140),
      ('EXPENSE','Sağlık','heart',150),
      ('EXPENSE','Eğitim','book',160),
      ('EXPENSE','Sosyal','users',170),
      ('EXPENSE','Vergi','building',180),
      ('EXPENSE','Diğer','dots',190)
    ) AS defaults(category_type,name,icon,sort_order)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM categories c
      WHERE c.book_id=target_book AND c.category_type=item.category_type
        AND lower(c.name)=lower(item.name) AND c.deleted_at IS NULL
    ) THEN
      INSERT INTO accounts(book_id,name,account_type,normal_balance,currency_code,is_system)
      VALUES(
        target_book,
        'Category: ' || item.name,
        CASE item.category_type WHEN 'INCOME' THEN 'SYSTEM_INCOME' ELSE 'SYSTEM_EXPENSE' END,
        CASE item.category_type WHEN 'INCOME' THEN 'CREDIT' ELSE 'DEBIT' END,
        target_currency,
        true
      ) RETURNING id INTO hidden_account;

      INSERT INTO categories(book_id,name,category_type,system_account_id,icon,sort_order,is_system,is_active)
      VALUES(target_book,item.name,item.category_type,hidden_account,item.icon,item.sort_order,true,true);
    END IF;
  END LOOP;
END $$;

CREATE TABLE investment_asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  icon TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE UNIQUE INDEX investment_asset_types_name_unique
  ON investment_asset_types(book_id,lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE investment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  asset_type_id UUID NOT NULL REFERENCES investment_asset_types(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  symbol TEXT CHECK (symbol IS NULL OR char_length(symbol) BETWEEN 1 AND 30),
  currency_code CHAR(3) NOT NULL DEFAULT 'TRY',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE UNIQUE INDEX investment_instruments_name_unique
  ON investment_instruments(book_id,lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX investment_instruments_type_idx
  ON investment_instruments(book_id,asset_type_id) WHERE deleted_at IS NULL;

CREATE TABLE investment_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  instrument_id UUID NOT NULL REFERENCES investment_instruments(id),
  account_id UUID REFERENCES accounts(id),
  quantity NUMERIC(24,8) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(20,6) NOT NULL CHECK (unit_price > 0),
  purchased_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE INDEX investment_lots_instrument_idx
  ON investment_lots(book_id,instrument_id,purchased_at) WHERE deleted_at IS NULL;

CREATE TABLE investment_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES investment_instruments(id),
  price NUMERIC(20,6) NOT NULL CHECK (price > 0),
  priced_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instrument_id,priced_at)
);
CREATE INDEX investment_prices_latest_idx ON investment_prices(instrument_id,priced_at DESC);

CREATE FUNCTION seed_default_investment_types(target_book UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO investment_asset_types(book_id,name,icon,is_system,sort_order)
  SELECT target_book,item.name,item.icon,true,item.sort_order
  FROM (VALUES
    ('Hisse','chart',10),
    ('Yatırım Fonu','layers',20),
    ('ETF','grid',30),
    ('Altın / Kıymetli Maden','sparkle',40),
    ('Kripto Varlık','coin',50),
    ('Döviz','currency',60),
    ('Diğer','dots',70)
  ) AS item(name,icon,sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM investment_asset_types existing
    WHERE existing.book_id=target_book AND lower(existing.name)=lower(item.name) AND existing.deleted_at IS NULL
  );
END $$;

DO $$ DECLARE item RECORD;
BEGIN
  FOR item IN SELECT id,base_currency FROM books WHERE deleted_at IS NULL LOOP
    PERFORM seed_default_categories(item.id,item.base_currency);
    PERFORM seed_default_investment_types(item.id);
  END LOOP;
END $$;
