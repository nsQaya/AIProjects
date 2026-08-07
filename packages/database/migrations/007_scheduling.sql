CREATE TABLE scheduled_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  target_account_id UUID REFERENCES accounts(id),
  transaction_type TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  contact_id UUID REFERENCES contacts(id),
  title TEXT NOT NULL,
  amount NUMERIC(20,6) NOT NULL CHECK (amount > 0),
  currency_code CHAR(3) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  reminder_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','SKIPPED','CANCELLED','OVERDUE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX scheduled_upcoming_idx ON scheduled_transactions(book_id, scheduled_at) WHERE status IN ('PENDING','OVERDUE') AND deleted_at IS NULL;

CREATE TABLE recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  account_id UUID NOT NULL REFERENCES accounts(id), target_account_id UUID REFERENCES accounts(id),
  transaction_type TEXT NOT NULL, category_id UUID REFERENCES categories(id), contact_id UUID REFERENCES contacts(id),
  title TEXT NOT NULL, amount NUMERIC(20,6) NOT NULL CHECK (amount > 0), currency_code CHAR(3) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL, end_date TIMESTAMPTZ, next_run_at TIMESTAMPTZ NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY','YEARLY','CUSTOM')),
  interval INTEGER NOT NULL DEFAULT 1 CHECK (interval > 0), is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX recurring_due_idx ON recurring_transactions(next_run_at) WHERE is_active AND deleted_at IS NULL;

CREATE TABLE recurring_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recurring_transaction_id UUID NOT NULL REFERENCES recurring_transactions(id),
  scheduled_for TIMESTAMPTZ NOT NULL, transaction_id UUID REFERENCES transactions(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recurring_transaction_id, scheduled_for)
);

