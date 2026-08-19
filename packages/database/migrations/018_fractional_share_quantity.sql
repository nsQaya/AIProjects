-- US markets increasingly support fractional-share trading down to 9 decimal
-- places; the previous NUMERIC(24,8) columns only allowed 8, one short of
-- what brokers actually let people enter. Widen quantity precision on both
-- lots and sales so a fractional purchase/sale can be recorded exactly.
ALTER TABLE investment_lots ALTER COLUMN quantity TYPE NUMERIC(24,9);
ALTER TABLE investment_sales ALTER COLUMN quantity TYPE NUMERIC(24,9);
