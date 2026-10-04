-- À appliquer sur PostgreSQL en production avant le déploiement.
-- Les références nulles restent autorisées; toute référence de paiement renseignée est globale et unique.
DO $$
BEGIN
  ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS "referencePaiement" varchar(150);

  IF EXISTS (
    SELECT 1
    FROM transactions
    WHERE "referencePaiement" IS NOT NULL
    GROUP BY "referencePaiement"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Des références de paiement existent déjà en double; corrigez-les avant cette migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_reference_paiement
  ON transactions ("referencePaiement")
  WHERE "referencePaiement" IS NOT NULL;
