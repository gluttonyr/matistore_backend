-- Mati-Pay SMS capture. Mirrors the TypeORM entities (production has synchronize off).
-- gen_random_uuid() is built in since PostgreSQL 13 (earlier: CREATE EXTENSION pgcrypto).

DO $$ BEGIN
  CREATE TYPE sms_capture_status AS ENUM ('ATTRIBUE', 'SANS_TRANSACTION', 'A_RAPPROCHER', 'IGNORE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sms_attribution_origin AS ENUM ('AUTO_MATI_PAY', 'MATISTORE', 'MANUEL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sms_captures (
  "trackingId" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint varchar(64) NOT NULL,
  device_id varchar(160) NOT NULL,
  expediteur varchar(160) NOT NULL,
  corps text NOT NULL,
  received_at timestamp NOT NULL,
  operateur varchar(100),
  montant integer,
  telephone varchar(40),
  reference varchar(160),
  statut sms_capture_status NOT NULL,
  transaction_id uuid,
  origine_attribution sms_attribution_origin,
  attribue_par_id integer,
  motif text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_sms_captures_fingerprint UNIQUE (fingerprint),
  CONSTRAINT fk_sms_captures_transaction FOREIGN KEY (transaction_id)
    REFERENCES transactions ("trackingId") ON DELETE SET NULL,
  CONSTRAINT fk_sms_captures_attribue_par FOREIGN KEY (attribue_par_id)
    REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sms_capture_device_tokens (
  id SERIAL PRIMARY KEY,
  admin_id integer NOT NULL,
  device_id varchar(160) NOT NULL,
  token_hash varchar(64) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  last_used_at timestamp,
  revoked_at timestamp,
  CONSTRAINT uq_sms_capture_device_tokens_hash UNIQUE (token_hash)
);
