-- Aşama 2: birikim alımı artık gerçek bir ledger işlemi üretir (aracı kurum
-- hesabından nakit çıkar, SYSTEM_EQUITY borçlanır). Lot ile onu doğuran işlemi
-- bağlamak için transaction_id eklenir; bu değişiklikten önce girilmiş uygun
-- lotlar (TL cinsli + geçerli bir aracı kurum hesabı olan) geriye dönük bağlanır.
ALTER TABLE investment_lots
  ADD COLUMN transaction_id UUID REFERENCES transactions(id);

CREATE UNIQUE INDEX investment_lots_transaction_unique
  ON investment_lots(transaction_id) WHERE transaction_id IS NOT NULL;

DO $$
DECLARE
  lot RECORD;
  equity_account UUID;
  new_tx UUID;
  cost NUMERIC(20,6);
BEGIN
  FOR lot IN
    SELECT l.id, l.book_id, l.account_id, l.quantity, l.unit_price, l.purchased_at,
           i.name AS instrument_name, b.base_currency, b.owner_user_id
    FROM investment_lots l
    JOIN investment_instruments i ON i.id = l.instrument_id
    JOIN books b ON b.id = l.book_id
    JOIN accounts acc ON acc.id = l.account_id
    WHERE l.deleted_at IS NULL
      AND l.transaction_id IS NULL
      AND l.account_id IS NOT NULL
      AND i.currency_code = b.base_currency
      AND acc.currency_code = b.base_currency
      AND acc.deleted_at IS NULL
  LOOP
    SELECT a.id INTO equity_account
    FROM accounts a
    JOIN account_types t ON t.id = a.account_type_id
    WHERE a.book_id = lot.book_id AND t.purpose = 'SYSTEM_EQUITY' AND a.deleted_at IS NULL
    LIMIT 1;
    CONTINUE WHEN equity_account IS NULL;

    cost := round(lot.quantity * lot.unit_price, 6);
    CONTINUE WHEN cost <= 0;

    INSERT INTO transactions(
      book_id, transaction_type, account_id, target_account_id, title, description,
      transaction_date, status, currency_code, client_operation_id, created_by
    ) VALUES (
      lot.book_id, 'ADJUSTMENT', equity_account, lot.account_id,
      'Birikim alımı: ' || lot.instrument_name, 'Aşama 2 geriye dönük kayıt',
      lot.purchased_at, 'POSTED', lot.base_currency, gen_random_uuid(), lot.owner_user_id
    ) RETURNING id INTO new_tx;

    INSERT INTO transaction_entries(transaction_id, account_id, direction, amount, currency_code, base_amount)
    VALUES (new_tx, equity_account, 'DEBIT', cost, lot.base_currency, cost),
           (new_tx, lot.account_id, 'CREDIT', cost, lot.base_currency, cost);

    UPDATE investment_lots SET transaction_id = new_tx WHERE id = lot.id;
  END LOOP;
END $$;
