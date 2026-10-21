-- Every newsletter signup, kept by us before Buttondown is asked (src/server/signup-store.js), so a Buttondown refusal
-- (a plan limit, an outage) never loses a person. The address, its tags (lists: firmware, nera, <app>-beta, ...), when
-- it was first and last given, and whether Buttondown has it. Nothing else of the person.
CREATE TABLE IF NOT EXISTS newsletter_signups (
  email TEXT PRIMARY KEY,
  tags TEXT NOT NULL DEFAULT '',
  first_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  buttondown_at TEXT,
  buttondown_error TEXT
);
CREATE INDEX IF NOT EXISTS newsletter_signups_pending ON newsletter_signups (buttondown_at);
