ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS credit_error text;
