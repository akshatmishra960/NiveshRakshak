CREATE TABLE IF NOT EXISTS scans (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(80) NOT NULL,
  source VARCHAR(40) NOT NULL,
  language VARCHAR(40) NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  level VARCHAR(40) NOT NULL,
  text_hash CHAR(64) NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  full_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_signals (
  id BIGSERIAL PRIMARY KEY,
  scan_id BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  signal_name VARCHAR(100) NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scans_session_created ON scans(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_signals_scan ON scan_signals(scan_id);
