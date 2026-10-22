-- Links each installment-plan scheduled TRANSFER back to the single EXPENSE
-- transaction that originally posted the full purchase against the card. The
-- card ekstresi (statement) view uses this to tell "a plain one-shot
-- purchase" apart from "the full-amount posting behind an installment plan" -
-- without it, both look like an ordinary EXPENSE transaction on the card and
-- the full purchase amount would double-count alongside its own installments.
ALTER TABLE scheduled_transactions
  ADD COLUMN origin_transaction_id UUID REFERENCES transactions(id);
