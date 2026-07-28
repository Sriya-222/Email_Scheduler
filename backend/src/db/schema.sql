CREATE TABLE IF NOT EXISTS senders (
  id            VARCHAR(36) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  smtp_user     VARCHAR(255) NOT NULL,
  smtp_pass     VARCHAR(255) NOT NULL,
  max_per_hour  INT NOT NULL DEFAULT 200,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(255) NOT NULL,       -- Google sub
  subject       VARCHAR(500) NOT NULL,
  body          TEXT NOT NULL,
  delay_ms      INT NOT NULL,
  hourly_limit  INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emails (
  id            VARCHAR(36) PRIMARY KEY,      -- used as BullMQ jobId for idempotency
  campaign_id   VARCHAR(36) NOT NULL,
  sender_id     VARCHAR(36) NOT NULL,
  recipient     VARCHAR(255) NOT NULL,
  subject       VARCHAR(500) NOT NULL,
  body          TEXT NOT NULL,
  scheduled_at  DATETIME NOT NULL,
  status        ENUM('scheduled','processing','sent','failed','rescheduled') NOT NULL DEFAULT 'scheduled',
  attempts      INT NOT NULL DEFAULT 0,
  sent_at       DATETIME NULL,
  error         TEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status_scheduled (status, scheduled_at),
  INDEX idx_campaign (campaign_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES senders(id) ON DELETE CASCADE
);
