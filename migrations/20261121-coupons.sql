-- Coupons du jour + notification link. Mirrors src/coupon and src/app-notification (production has synchronize off).
-- Run BEFORE deploying the backend that contains the coupon module. Safe to run twice.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS coupons (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  number integer NOT NULL,
  image_url text NOT NULL,
  codes jsonb NOT NULL,
  odds varchar(12),
  note varchar(120),
  status varchar(10) NOT NULL DEFAULT 'EN_COURS',
  created_by_id integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY (id),
  CONSTRAINT "UQ_656e7ba07b241bb79e6c48607ce" UNIQUE (number)
);
CREATE INDEX IF NOT EXISTS idx_coupons_created_at ON coupons (created_at);

-- What a notification opens ("coupon:<id>").
ALTER TABLE app_notifications ADD COLUMN IF NOT EXISTS link varchar(120);

COMMIT;
