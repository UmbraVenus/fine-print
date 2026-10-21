-- Votes for features that are coming next: one per feature per browser (an anonymous voter cookie).
-- Not sample data, so Reset leaves them alone.
CREATE TABLE feature_votes (
  feature TEXT NOT NULL,
  voter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (feature, voter)
);
