CREATE TABLE IF NOT EXISTS admin_capture_devices (
  id SERIAL PRIMARY KEY,
  admin_id integer NOT NULL,
  device_id varchar(160) NOT NULL,
  last_heartbeat_at timestamp NOT NULL,
  consecutive_healthy_signals integer NOT NULL DEFAULT 0,
  failure_reason varchar(80),
  CONSTRAINT uq_admin_capture_device UNIQUE (admin_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_capture_devices_heartbeat
  ON admin_capture_devices (last_heartbeat_at DESC);

CREATE TABLE IF NOT EXISTS admin_capture_state (
  id smallint PRIMARY KEY DEFAULT 1,
  manual_override boolean NOT NULL DEFAULT false,
  outage_started_at timestamp,
  paused_expiration_ms bigint NOT NULL DEFAULT 0,
  last_reminder_at timestamp,
  last_reported_available boolean NOT NULL DEFAULT false,
  CONSTRAINT chk_admin_capture_state_singleton CHECK (id = 1)
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS capture_pause_ms_at_creation bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capture_reconciliation_required boolean NOT NULL DEFAULT false;
