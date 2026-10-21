CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Claims', 'Required elements', 'Presentation')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'caution')),
  description TEXT NOT NULL,
  applies_to TEXT NOT NULL,          -- json: products and/or "affiliate"
  dont_example TEXT NOT NULL,        -- plain text, or json lines [{text, size}]
  do_example TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE ads (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('personal_loan', 'credit_card', 'mortgage')),
  source TEXT NOT NULL,              -- 'internal' or the affiliate publisher's name
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'changes_required', 'approved_with_changes', 'approved', 'rejected')),
  current_version INTEGER NOT NULL DEFAULT 1,
  is_mine INTEGER NOT NULL DEFAULT 0, -- shown in the marketer's My ads
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  live_since TEXT
);
CREATE INDEX ads_status ON ads (status);

CREATE TABLE ad_versions (
  id INTEGER PRIMARY KEY,
  ad_id INTEGER NOT NULL REFERENCES ads (id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  theme TEXT NOT NULL,               -- json
  layers TEXT NOT NULL,              -- json [{id, role, text, style?}]
  submitted_at TEXT,                 -- null while it's a draft
  created_at TEXT NOT NULL,
  UNIQUE (ad_id, version)
);

CREATE TABLE check_runs (
  id INTEGER PRIMARY KEY,
  ad_version_id INTEGER NOT NULL REFERENCES ad_versions (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('seeded', 'live', 'compared')),
  good_rule_ids TEXT NOT NULL DEFAULT '[]',
  checks_run INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  error TEXT
);
CREATE INDEX check_runs_version ON check_runs (ad_version_id);

CREATE TABLE findings (
  id INTEGER PRIMARY KEY,
  ad_version_id INTEGER NOT NULL REFERENCES ad_versions (id) ON DELETE CASCADE,
  check_run_id INTEGER REFERENCES check_runs (id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK (origin IN ('auto', 'reviewer')),
  rule_id TEXT REFERENCES rules (id),
  severity TEXT CHECK (severity IN ('critical', 'caution')),
  layer_id TEXT,
  quote TEXT,
  text TEXT NOT NULL,
  fix_label TEXT CHECK (fix_label IN ('Suggested fix', 'Suggested wording')),
  suggested_fix TEXT,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'kept', 'edited', 'dismissed')),
  edited_text TEXT,
  dismiss_reason TEXT,
  submitter_note TEXT,
  sent_to_submitter INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX findings_version ON findings (ad_version_id);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  ad_id INTEGER NOT NULL REFERENCES ads (id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('Marketer', 'Reviewer', 'Auto check')),
  type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX events_ad ON events (ad_id);
CREATE INDEX events_type_at ON events (type, at);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
