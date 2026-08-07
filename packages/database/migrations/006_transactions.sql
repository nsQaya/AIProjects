CREATE SEQUENCE transaction_number_seq;

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  transaction_no BIGINT NOT NULL DEFAULT nextval('transaction_number_seq'),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'INCOME','EXPENSE','TRANSFER','SALE','PURCHASE','COLLECTION','PAYMENT',
    'OPENING_BALANCE','ADJUSTMENT','REVERSAL'
  )),
  category_id UUID REFERENCES categories(id),
  contact_id UUID REFERENCES contacts(id),
  title TEXT NOT NULL,
  description TEXT,
  transaction_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','POSTED','REVERSED','CANCELLED')),
  currency_code CHAR(3) NOT NULL,
  client_operation_id UUID NOT NULL,
  reverses_transaction_id UUID REFERENCES transactions(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(book_id, transaction_no),
  UNIQUE(book_id, client_operation_id)
);
CREATE INDEX transactions_book_date_idx ON transactions(book_id, transaction_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE transaction_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  amount NUMERIC(20,6) NOT NULL CHECK (amount > 0),
  currency_code CHAR(3) NOT NULL,
  base_amount NUMERIC(20,6) NOT NULL CHECK (base_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transaction_entries_transaction_idx ON transaction_entries(transaction_id);
CREATE INDEX transaction_entries_account_idx ON transaction_entries(account_id);

CREATE FUNCTION assert_transaction_balanced(target_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE tx_status TEXT; debit_total NUMERIC(20,6); credit_total NUMERIC(20,6); entry_count INTEGER;
BEGIN
  SELECT status INTO tx_status FROM transactions WHERE id = target_id;
  IF tx_status = 'POSTED' THEN
    SELECT COALESCE(SUM(base_amount) FILTER (WHERE direction='DEBIT'),0),
           COALESCE(SUM(base_amount) FILTER (WHERE direction='CREDIT'),0), COUNT(*)
      INTO debit_total, credit_total, entry_count FROM transaction_entries WHERE transaction_id=target_id;
    IF entry_count < 2 OR debit_total <> credit_total THEN
      RAISE EXCEPTION 'unbalanced posted transaction %: debit %, credit %', target_id, debit_total, credit_total;
    END IF;
  END IF;
END $$;

CREATE FUNCTION transaction_balance_trigger() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM assert_transaction_balanced(COALESCE(NEW.transaction_id, OLD.transaction_id)); RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER entries_must_balance AFTER INSERT OR UPDATE OR DELETE ON transaction_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transaction_balance_trigger();

CREATE FUNCTION transaction_status_balance_trigger() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN PERFORM assert_transaction_balanced(NEW.id); RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER posted_transaction_must_balance AFTER INSERT OR UPDATE OF status ON transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION transaction_status_balance_trigger();

CREATE FUNCTION protect_posted_entries() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE tx_status TEXT;
BEGIN
  SELECT status INTO tx_status FROM transactions WHERE id=OLD.transaction_id;
  IF tx_status IN ('POSTED','REVERSED') THEN RAISE EXCEPTION 'posted ledger entries are immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER posted_entries_immutable BEFORE UPDATE OR DELETE ON transaction_entries
  FOR EACH ROW EXECUTE FUNCTION protect_posted_entries();

