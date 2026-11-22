-- Bookmaker choice (1XBET, MELBET…). Mirrors the TypeORM entities (production has synchronize off).
-- Run BEFORE deploying the backend that contains the bookmaker module. Safe to run twice.

CREATE TABLE IF NOT EXISTS bookmakers (
  code varchar(20) PRIMARY KEY,
  nom varchar(60) NOT NULL,
  image_url varchar(255),
  site_url varchar(255),
  app_schemes text,
  active boolean NOT NULL DEFAULT false,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Same rows as the backend seeds at start; existing rows are left as they are.
INSERT INTO bookmakers (code, nom, image_url, site_url, app_schemes, active, ordre) VALUES
  ('1XBET', '1XBET', '1xbet.png', 'https://1xbet.com', '["xbet://open","xbet://openapp"]', true, 1),
  ('MELBET', 'MELBET', 'melbet.png', 'https://melbet.com', '[]', false, 2)
ON CONFLICT (code) DO NOTHING;

-- Every existing transaction was a 1XBET one.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bookmaker varchar(20) NOT NULL DEFAULT '1XBET';

-- To switch MELBET on later, once MELBET_* is filled in the .env and the backend redeployed:
--   UPDATE bookmakers SET active = true WHERE code = 'MELBET';
