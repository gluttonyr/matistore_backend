ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS code_retrait varchar(255);
