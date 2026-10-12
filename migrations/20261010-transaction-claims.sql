-- À appliquer sur PostgreSQL avant de déployer le flux de réclamation.
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
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_enum, 'EN_RECLAMATION');
  END IF;
END $$;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS date_reclamation timestamp,
  ADD COLUMN IF NOT EXISTS date_traitement_reclamation timestamp;
