CREATE INDEX IF NOT EXISTS idx_transactions_user_created_tracking
  ON transactions (user_id, created_at DESC, tracking_id DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_updated
  ON transactions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_admin_priority_updated
  ON transactions (statut, capture_reconciliation_required, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_discussion_updated
  ON transactions (discussion_tracking_id, updated_at DESC);
