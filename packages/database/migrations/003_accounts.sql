CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  contact_id UUID,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  account_type TEXT NOT NULL CHECK (account_type IN (
    'CASH','BANK','CREDIT_CARD','CUSTOMER','SUPPLIER','RECEIVABLE','PAYABLE',
    'SAVINGS','BUDGET','PERSONNEL','OTHER','SYSTEM_INCOME','SYSTEM_EXPENSE','SYSTEM_EQUITY'
  )),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  currency_code CHAR(3) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX accounts_book_idx ON accounts(book_id, sort_order) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX accounts_contact_unique ON accounts(contact_id) WHERE contact_id IS NOT NULL AND deleted_at IS NULL;

