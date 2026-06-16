-- Run this in Supabase SQL editor
CREATE TABLE IF NOT EXISTS pinned (
  can_id text NOT NULL,
  type   text NOT NULL DEFAULT 'can',
  PRIMARY KEY (can_id, type)
);

ALTER TABLE pinned ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pinned' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY "allow_all" ON pinned FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
