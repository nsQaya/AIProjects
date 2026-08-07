CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  parent_id UUID REFERENCES categories(id),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category_type TEXT NOT NULL CHECK (category_type IN ('INCOME', 'EXPENSE')),
  system_account_id UUID NOT NULL REFERENCES accounts(id),
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX categories_book_idx ON categories(book_id, category_type, sort_order) WHERE deleted_at IS NULL;

