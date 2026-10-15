-- The funnel, as numbers only: one tally per day, step and source (a link's ?ref=, from an allowlist).
-- Nothing about the person is kept: no address, IP, browser, cookie or account.
CREATE TABLE IF NOT EXISTS funnel_counts (
  day TEXT NOT NULL,
  step TEXT NOT NULL,
  source TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, step, source)
);
