-- Birikim alımları bugün hiçbir hesaptan para düşürmüyor; aracı kurumdaki
-- (Piapiri, Binance, BES kurumu) para kavramı yok. İlk adım: hesap türüne
-- "yatırım/aracı kurum hesabı" işareti eklemek. Birikim alım-satım formları
-- yalnızca bu türdeki hesapları hedef olarak listeler.
ALTER TABLE account_types
  ADD COLUMN is_investment BOOLEAN NOT NULL DEFAULT false;

-- Seedlenmiş "Birikim" türü aracı kurum hesabı davranışını üstlenir.
UPDATE account_types
  SET is_investment = true
  WHERE is_system = true AND lower(name) = 'birikim' AND deleted_at IS NULL;

-- Geriye dönük koruma: hâlihazırda bir alım lotuna ya da satışa bağlı olan her
-- hesap türü de yatırım hesabı sayılır, böylece mevcut kayıtların düzenlenmesi
-- yeni kısıt yüzünden bozulmaz.
UPDATE account_types SET is_investment = true WHERE id IN (
  SELECT a.account_type_id FROM accounts a
    JOIN investment_lots l ON l.account_id = a.id
    WHERE l.deleted_at IS NULL
  UNION
  SELECT a.account_type_id FROM accounts a
    JOIN investment_sales s ON s.destination_account_id = a.id
    WHERE s.deleted_at IS NULL
);

-- 019_account_types.sql'deki tanımın aynısı; tek fark "Birikim" satırının yeni
-- defterlerde de is_investment=true seedlenmesi.
CREATE OR REPLACE FUNCTION seed_default_account_types(target_book UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO account_types(book_id,name,icon,normal_balance,default_allow_negative_balance,purpose,is_investment,is_system,sort_order)
  SELECT target_book,item.name,item.icon,item.normal_balance,item.default_allow_negative_balance,item.purpose,item.is_investment,true,item.sort_order
  FROM (VALUES
    ('Nakit','wallet','DEBIT',false,NULL::text,false,10),
    ('Banka','bank','DEBIT',false,NULL,false,20),
    ('Kredi Kartı','card','CREDIT',true,NULL,false,30),
    ('Alacak','arrow-down','DEBIT',false,NULL,false,40),
    ('Borç','arrow-up','CREDIT',true,NULL,false,50),
    ('Birikim','piggy-bank','DEBIT',false,NULL,true,60),
    ('Bütçe','folder','DEBIT',false,NULL,false,70),
    ('Personel','user','DEBIT',false,NULL,false,80),
    ('Müşteri','users','DEBIT',false,'CUSTOMER',false,90),
    ('Tedarikçi','truck','CREDIT',true,'SUPPLIER',false,100),
    ('Diğer','dots','DEBIT',false,'OTHER',false,110),
    ('Sistem Gelir','trend','CREDIT',false,'SYSTEM_INCOME',false,900),
    ('Sistem Gider','receipt','DEBIT',false,'SYSTEM_EXPENSE',false,910),
    ('Açılış Sermayesi','building','CREDIT',false,'SYSTEM_EQUITY',false,920)
  ) AS item(name,icon,normal_balance,default_allow_negative_balance,purpose,is_investment,sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM account_types existing
    WHERE existing.book_id=target_book AND lower(existing.name)=lower(item.name) AND existing.deleted_at IS NULL
  );
END $$;
