CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id),
  key TEXT NOT NULL, request_hash TEXT NOT NULL, status_code INTEGER, response_body JSONB,
  locked_until TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, key)
);

CREATE TABLE sync_changes (
  sequence BIGSERIAL PRIMARY KEY, book_id UUID NOT NULL REFERENCES books(id),
  entity_type TEXT NOT NULL, entity_id UUID NOT NULL, action TEXT NOT NULL CHECK(action IN ('UPSERT','DELETE')),
  entity_version INTEGER NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sync_changes_book_cursor_idx ON sync_changes(book_id, sequence);

