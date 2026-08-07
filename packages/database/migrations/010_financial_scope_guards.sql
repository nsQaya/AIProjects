CREATE FUNCTION guard_transaction_entry_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE tx_book UUID; tx_currency CHAR(3); account_book UUID; account_currency CHAR(3); account_deleted TIMESTAMPTZ;
BEGIN
  SELECT book_id,currency_code INTO tx_book,tx_currency FROM transactions WHERE id=NEW.transaction_id;
  SELECT book_id,currency_code,deleted_at INTO account_book,account_currency,account_deleted FROM accounts WHERE id=NEW.account_id;
  IF tx_book IS NULL OR account_book IS NULL OR tx_book<>account_book THEN RAISE EXCEPTION 'transaction entry account must belong to transaction book'; END IF;
  IF account_deleted IS NOT NULL THEN RAISE EXCEPTION 'transaction entry cannot use deleted account'; END IF;
  IF tx_currency<>account_currency OR NEW.currency_code<>tx_currency THEN RAISE EXCEPTION 'V1 transaction and account currencies must match'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER transaction_entry_scope BEFORE INSERT ON transaction_entries FOR EACH ROW EXECUTE FUNCTION guard_transaction_entry_scope();

ALTER TABLE scheduled_transactions ADD CONSTRAINT scheduled_transaction_type_check CHECK(transaction_type IN ('INCOME','EXPENSE','TRANSFER','SALE','PURCHASE','COLLECTION','PAYMENT'));
ALTER TABLE recurring_transactions ADD CONSTRAINT recurring_transaction_type_check CHECK(transaction_type IN ('INCOME','EXPENSE','TRANSFER','SALE','PURCHASE','COLLECTION','PAYMENT'));

