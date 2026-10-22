ALTER TABLE accounts ADD COLUMN default_funding_account_id UUID REFERENCES accounts(id);
