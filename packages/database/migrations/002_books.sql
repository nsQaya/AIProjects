CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  book_type TEXT NOT NULL CHECK (book_type IN ('PERSONAL', 'BUSINESS', 'OTHER')),
  base_currency CHAR(3) NOT NULL DEFAULT 'TRY',
  owner_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE book_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'EDITOR', 'ACCOUNTANT', 'VIEWER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('INVITED', 'ACTIVE', 'DISABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX book_members_active_unique ON book_members(book_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX book_members_user_idx ON book_members(user_id, status) WHERE deleted_at IS NULL;

