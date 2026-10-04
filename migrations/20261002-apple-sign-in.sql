ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "appleId" character varying;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_appleId_unique"
  ON users ("appleId")
  WHERE "appleId" IS NOT NULL;
