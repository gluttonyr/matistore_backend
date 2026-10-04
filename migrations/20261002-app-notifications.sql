CREATE TABLE IF NOT EXISTS app_notifications (
  id SERIAL PRIMARY KEY,
  "trackingId" varchar NOT NULL UNIQUE,
  title varchar(100) NOT NULL,
  body varchar(500) NOT NULL,
  image_url text,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by varchar(100),
  updated_by varchar(100),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON app_notifications (user_id, "createdAt" DESC);
