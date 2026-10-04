-- À appliquer une fois sur les bases PostgreSQL existantes avant le déploiement.
-- Les anciennes règles de notification sont conservées comme configuration client.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operateurs' AND column_name = 'notification_package'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operateurs' AND column_name = 'notification_package_client'
  ) THEN
    ALTER TABLE operateurs RENAME COLUMN notification_package TO notification_package_client;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operateurs' AND column_name = 'notification_pattern'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operateurs' AND column_name = 'notification_pattern_client'
  ) THEN
    ALTER TABLE operateurs RENAME COLUMN notification_pattern TO notification_pattern_client;
  END IF;
END $$;

ALTER TABLE operateurs
  ADD COLUMN IF NOT EXISTS notification_package_admin varchar(150),
  ADD COLUMN IF NOT EXISTS notification_pattern_admin text;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reference_client varchar(150),
  ADD COLUMN IF NOT EXISTS notification_brute_client text,
  ADD COLUMN IF NOT EXISTS discussion_tracking_id varchar(100);

UPDATE transactions t
SET discussion_tracking_id = d."trackingId"
FROM discussion_participants dp
JOIN discussions d ON d.id = dp."discussionId"
WHERE dp."userId" = t.user_id
  AND d.type = 'depot_retrait'
  AND t.discussion_tracking_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE discussion_tracking_id IS NULL) THEN
    RAISE EXCEPTION 'Certaines transactions n’ont pas de discussion depot_retrait associée';
  END IF;
  ALTER TABLE transactions ALTER COLUMN discussion_tracking_id SET NOT NULL;
END $$;

DO $$
DECLARE status_enum text;
BEGIN
  SELECT typ.typname INTO status_enum
  FROM pg_type typ
  JOIN pg_enum enm ON enm.enumtypid = typ.oid
  JOIN pg_class tbl ON tbl.relname = 'transactions'
  JOIN pg_attribute attr ON attr.attrelid = tbl.oid AND attr.atttypid = typ.oid
  WHERE attr.attname = 'statut'
  LIMIT 1;

  IF status_enum IS NOT NULL THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum, 'EN_VERIFICATION');
  END IF;
END $$;
