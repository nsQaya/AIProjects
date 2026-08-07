CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), book_id UUID NOT NULL REFERENCES books(id),
  actor_user_id UUID NOT NULL REFERENCES users(id), entity_type TEXT NOT NULL, entity_id UUID NOT NULL,
  action TEXT NOT NULL, old_values JSONB, new_values JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_book_created_idx ON audit_logs(book_id, created_at DESC);

