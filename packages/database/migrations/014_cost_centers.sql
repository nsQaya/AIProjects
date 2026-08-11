CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description)<=500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX cost_centers_book_idx
  ON cost_centers(book_id,is_active,sort_order,name);

ALTER TABLE transactions
  ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id);

ALTER TABLE scheduled_transactions
  ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id);

CREATE INDEX transactions_cost_center_idx
  ON transactions(book_id,cost_center_id,transaction_date DESC)
  WHERE cost_center_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX scheduled_cost_center_idx
  ON scheduled_transactions(book_id,cost_center_id,scheduled_at)
  WHERE cost_center_id IS NOT NULL AND deleted_at IS NULL;

CREATE FUNCTION guard_cost_center_book_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE cost_center_book UUID;
BEGIN
  IF NEW.cost_center_id IS NULL THEN RETURN NEW; END IF;
  SELECT book_id INTO cost_center_book FROM cost_centers WHERE id=NEW.cost_center_id;
  IF cost_center_book IS NULL OR cost_center_book<>NEW.book_id THEN
    RAISE EXCEPTION 'cost center must belong to the same book';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER transaction_cost_center_book_scope
  BEFORE INSERT OR UPDATE OF book_id,cost_center_id ON transactions
  FOR EACH ROW EXECUTE FUNCTION guard_cost_center_book_scope();

CREATE TRIGGER scheduled_cost_center_book_scope
  BEFORE INSERT OR UPDATE OF book_id,cost_center_id ON scheduled_transactions
  FOR EACH ROW EXECUTE FUNCTION guard_cost_center_book_scope();
