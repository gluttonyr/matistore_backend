-- Referral tournament (parrainage). Mirrors the TypeORM entities in src/referral (production has synchronize off).
-- Run BEFORE deploying the backend that contains the referral module. Safe to run twice.
BEGIN;

CREATE TABLE IF NOT EXISTS referral_profiles (
  user_id integer NOT NULL,
  code varchar(16),
  code_created_at timestamp,
  parrain_id integer,
  parrain_since timestamp,
  prompt_seen boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_bdfa9f749908ac98d59960d5e77" PRIMARY KEY (user_id),
  CONSTRAINT "UQ_ffa574f242a5137ef2d61580919" UNIQUE (code),
  CONSTRAINT "FK_bdfa9f749908ac98d59960d5e77" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "FK_f4f6143c36dad9403272e545055" FOREIGN KEY (parrain_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_referral_profiles_parrain ON referral_profiles (parrain_id);

CREATE TABLE IF NOT EXISTS referral_settings (
  id integer NOT NULL,
  active boolean NOT NULL DEFAULT false,
  duration_days integer NOT NULL DEFAULT 7,
  winners_count integer NOT NULL DEFAULT 5,
  deposits_required integer NOT NULL DEFAULT 3,
  min_amount integer NOT NULL DEFAULT 500,
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_82f3d97e8deb3930cfdd8150386" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS referral_rounds (
  id serial NOT NULL,
  number integer NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'ACTIVE',
  start_at timestamp NOT NULL,
  end_at timestamp NOT NULL,
  duration_days integer NOT NULL,
  winners_count integer NOT NULL,
  deposits_required integer NOT NULL,
  min_amount integer NOT NULL,
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  finished_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_6e2cae2c991db9af47d5207cd74" PRIMARY KEY (id),
  CONSTRAINT "UQ_badc56ef70946e99a6b7958ee13" UNIQUE (number)
);

CREATE TABLE IF NOT EXISTS referral_winners (
  id serial NOT NULL,
  rank integer NOT NULL,
  validated_count integer NOT NULL,
  prize jsonb,
  rewarded boolean NOT NULL DEFAULT false,
  rewarded_at timestamp,
  rewarded_by_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  round_id integer,
  user_id integer,
  CONSTRAINT "PK_2ba191b673043afc1a0982bdb35" PRIMARY KEY (id),
  CONSTRAINT uq_referral_winners_round_rank UNIQUE (round_id, rank),
  CONSTRAINT "FK_e8c911442f88bac49413d966151" FOREIGN KEY (round_id) REFERENCES referral_rounds(id) ON DELETE CASCADE,
  CONSTRAINT "FK_7852717af5d64c5a3775892ae1a" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- The ranking reads validated deposits per user.
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_statut ON transactions (user_id, type, statut);

COMMIT;
