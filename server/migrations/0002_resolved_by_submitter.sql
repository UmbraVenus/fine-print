-- The submitter marks a suggestion resolved by hand; the reviewer sees it. A person decides, not the check.
ALTER TABLE findings ADD COLUMN resolved_by_submitter INTEGER NOT NULL DEFAULT 0;
