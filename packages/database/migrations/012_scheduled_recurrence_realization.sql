ALTER TABLE scheduled_transactions
  ADD COLUMN series_id UUID,
  ADD COLUMN recurrence_frequency TEXT,
  ADD COLUMN recurrence_interval INTEGER,
  ADD COLUMN recurrence_end_at TIMESTAMPTZ,
  ADD COLUMN completed_transaction_id UUID REFERENCES transactions(id),
  ADD CONSTRAINT scheduled_recurrence_frequency_check
    CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('WEEKLY','MONTHLY','YEARLY')),
  ADD CONSTRAINT scheduled_recurrence_interval_check
    CHECK (recurrence_interval IS NULL OR recurrence_interval > 0),
  ADD CONSTRAINT scheduled_recurrence_shape_check CHECK (
    (series_id IS NULL AND recurrence_frequency IS NULL AND recurrence_interval IS NULL AND recurrence_end_at IS NULL)
    OR
    (series_id IS NOT NULL AND recurrence_frequency IS NOT NULL AND recurrence_interval IS NOT NULL AND recurrence_end_at IS NOT NULL)
  );

CREATE INDEX scheduled_series_idx
  ON scheduled_transactions(book_id,series_id,scheduled_at)
  WHERE series_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX scheduled_completed_transaction_unique
  ON scheduled_transactions(completed_transaction_id)
  WHERE completed_transaction_id IS NOT NULL;
