CREATE TABLE account_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  icon TEXT,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT','CREDIT')),
  default_allow_negative_balance BOOLEAN NOT NULL DEFAULT false,
  purpose TEXT CHECK (purpose IN ('SYSTEM_INCOME','SYSTEM_EXPENSE','SYSTEM_EQUITY','CUSTOMER','SUPPLIER','OTHER')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE UNIQUE INDEX account_types_name_unique
  ON account_types(book_id,lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX account_types_purpose_unique
  ON account_types(book_id,purpose) WHERE purpose IS NOT NULL AND deleted_at IS NULL;

CREATE FUNCTION seed_default_account_types(target_book UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO account_types(book_id,name,icon,normal_balance,default_allow_negative_balance,purpose,is_system,sort_order)
  SELECT target_book,item.name,item.icon,item.normal_balance,item.default_allow_negative_balance,item.purpose,true,item.sort_order
  FROM (VALUES
    ('Nakit','wallet','DEBIT',false,NULL::text,10),
    ('Banka','bank','DEBIT',false,NULL,20),
    ('Kredi Kartı','card','CREDIT',true,NULL,30),
    ('Alacak','arrow-down','DEBIT',false,NULL,40),
    ('Borç','arrow-up','CREDIT',true,NULL,50),
    ('Birikim','piggy-bank','DEBIT',false,NULL,60),
    ('Bütçe','folder','DEBIT',false,NULL,70),
    ('Personel','user','DEBIT',false,NULL,80),
    ('Müşteri','users','DEBIT',false,'CUSTOMER',90),
    ('Tedarikçi','truck','CREDIT',true,'SUPPLIER',100),
    ('Diğer','dots','DEBIT',false,'OTHER',110),
    ('Sistem Gelir','trend','CREDIT',false,'SYSTEM_INCOME',900),
    ('Sistem Gider','receipt','DEBIT',false,'SYSTEM_EXPENSE',910),
    ('Açılış Sermayesi','building','CREDIT',false,'SYSTEM_EQUITY',920)
  ) AS item(name,icon,normal_balance,default_allow_negative_balance,purpose,sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM account_types existing
    WHERE existing.book_id=target_book AND lower(existing.name)=lower(item.name) AND existing.deleted_at IS NULL
  );
END $$;

DO $$ DECLARE item RECORD;
BEGIN
  FOR item IN SELECT id FROM books WHERE deleted_at IS NULL LOOP
    PERFORM seed_default_account_types(item.id);
  END LOOP;
END $$;

-- seed_default_categories (defined in 011_live_web_and_investments.sql) creates a
-- hidden ledger account per category via the old account_type TEXT column, which
-- this migration removes below. Repoint it at account_type_id, resolved through
-- the SYSTEM_INCOME/SYSTEM_EXPENSE account_types row seeded for the book above.
CREATE OR REPLACE FUNCTION seed_default_categories(target_book UUID, target_currency CHAR(3)) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item RECORD; hidden_account UUID; type_row RECORD;
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
      SELECT id,normal_balance INTO type_row FROM account_types
      WHERE book_id=target_book
        AND purpose=(CASE item.category_type WHEN 'INCOME' THEN 'SYSTEM_INCOME' ELSE 'SYSTEM_EXPENSE' END)
        AND deleted_at IS NULL;

      INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
      VALUES(
        target_book,
        'Category: ' || item.name,
        type_row.id,
        type_row.normal_balance,
        target_currency,
        true
      ) RETURNING id INTO hidden_account;

      INSERT INTO categories(book_id,name,category_type,system_account_id,icon,sort_order,is_system,is_active)
      VALUES(target_book,item.name,item.category_type,hidden_account,item.icon,item.sort_order,true,true);
    END IF;
  END LOOP;
END $$;

-- Backfill existing accounts onto the new FK
ALTER TABLE accounts ADD COLUMN account_type_id UUID REFERENCES account_types(id);

UPDATE accounts a
SET account_type_id = at.id
FROM (VALUES
  ('CASH','Nakit'),('BANK','Banka'),('CREDIT_CARD','Kredi Kartı'),('CUSTOMER','Müşteri'),
  ('SUPPLIER','Tedarikçi'),('RECEIVABLE','Alacak'),('PAYABLE','Borç'),('SAVINGS','Birikim'),
  ('BUDGET','Bütçe'),('PERSONNEL','Personel'),('OTHER','Diğer'),
  ('SYSTEM_INCOME','Sistem Gelir'),('SYSTEM_EXPENSE','Sistem Gider'),('SYSTEM_EQUITY','Açılış Sermayesi')
) AS map(old_code,new_name), account_types at
WHERE a.account_type = map.old_code AND at.book_id = a.book_id AND at.name = map.new_name;

DO $$ DECLARE missing INT;
BEGIN
  SELECT count(*) INTO missing FROM accounts WHERE account_type_id IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'account_type_id backfill incomplete: % rows unresolved', missing;
  END IF;
END $$;

ALTER TABLE accounts ALTER COLUMN account_type_id SET NOT NULL;
CREATE INDEX accounts_account_type_id_idx ON accounts(account_type_id);

-- Drops the old CHECK constraint along with the column
ALTER TABLE accounts DROP COLUMN account_type;
