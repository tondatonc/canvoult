-- Run this once in Supabase SQL editor to create the pinned table
CREATE TABLE IF NOT EXISTS pinned (
  can_id text NOT NULL,
  type   text NOT NULL DEFAULT 'can',
  PRIMARY KEY (can_id, type)
);
ALTER TABLE pinned ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all" ON pinned FOR ALL USING (true) WITH CHECK (true);
