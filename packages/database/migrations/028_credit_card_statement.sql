-- Kredi kartı gibi kullanılan hesaplar için hesap kesim günü ve son ödeme
-- gününü (kesimden kaç gün sonra) tutar. Taksitli bir harcamanın her
-- taksidinin hangi ekstre dönemine düşeceğini bu bilgiyle hesaplayacağız;
-- statement_day boş olan hesaplarda taksit girişi sunulmaz.
ALTER TABLE accounts
  ADD COLUMN statement_day SMALLINT,
  ADD COLUMN payment_due_offset_days SMALLINT,
  ADD CONSTRAINT accounts_statement_day_range CHECK (statement_day IS NULL OR (statement_day BETWEEN 1 AND 28)),
  ADD CONSTRAINT accounts_payment_due_offset_nonnegative CHECK (payment_due_offset_days IS NULL OR payment_due_offset_days >= 0),
  ADD CONSTRAINT accounts_payment_due_offset_requires_statement_day CHECK (payment_due_offset_days IS NULL OR statement_day IS NOT NULL);
