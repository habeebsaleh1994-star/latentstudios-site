-- One anonymous tally per day, product and version. Nothing about the person is kept.
CREATE TABLE IF NOT EXISTS download_counts (
  day TEXT NOT NULL,
  product TEXT NOT NULL,
  version TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, product, version)
);
