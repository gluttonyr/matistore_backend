-- Supports paginated discussion previews, recent-message ordering, and unread counts.
CREATE INDEX IF NOT EXISTS idx_discussions_recent_order
  ON discussions (last_message_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_messages_unread_discussion_sender
  ON messages ("discussionId", "senderId")
  WHERE lu = false;

CREATE INDEX IF NOT EXISTS idx_messages_discussion_created_at
  ON messages ("discussionId", "createdAt" DESC);
