-- Relax the V1 single-currency guard. An entry's currency must still match its
-- own account, but a transaction may now touch accounts of different currencies
-- (an FX conversion, a foreign-currency investment posting) as long as it still
-- balances in the book's base currency, which assert_transaction_balanced keeps
-- enforcing on base_amount.
CREATE OR REPLACE FUNCTION guard_transaction_entry_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE tx_book UUID; account_book UUID; account_currency CHAR(3); account_deleted TIMESTAMPTZ;
BEGIN
  SELECT book_id INTO tx_book FROM transactions WHERE id=NEW.transaction_id;
  SELECT book_id,currency_code,deleted_at INTO account_book,account_currency,account_deleted FROM accounts WHERE id=NEW.account_id;
  IF tx_book IS NULL OR account_book IS NULL OR tx_book<>account_book THEN RAISE EXCEPTION 'transaction entry account must belong to transaction book'; END IF;
  IF account_deleted IS NOT NULL THEN RAISE EXCEPTION 'transaction entry cannot use deleted account'; END IF;
  IF NEW.currency_code<>account_currency THEN RAISE EXCEPTION 'transaction entry currency must match its account currency'; END IF;
  RETURN NEW;
END $$;
