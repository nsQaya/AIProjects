CREATE TABLE investment_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  instrument_id UUID NOT NULL REFERENCES investment_instruments(id),
  destination_account_id UUID NOT NULL REFERENCES accounts(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  client_operation_id UUID NOT NULL,
  quantity NUMERIC(24,8) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(20,6) NOT NULL CHECK (unit_price > 0),
  cost_basis NUMERIC(20,6) NOT NULL CHECK (cost_basis >= 0),
  sold_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE(book_id,client_operation_id),
  UNIQUE(transaction_id)
);

CREATE INDEX investment_sales_instrument_idx
  ON investment_sales(book_id,instrument_id,sold_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX investment_sales_destination_idx
  ON investment_sales(destination_account_id,sold_at DESC)
  WHERE deleted_at IS NULL;
