-- Run this in the Supabase SQL editor (once).
-- One vote per browser (voter id). Stores the colour method chosen and the sort switches in use.
CREATE TABLE IF NOT EXISTS color_votes (
  voter      text PRIMARY KEY,
  method     text NOT NULL,
  scope      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE color_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'color_votes' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY "allow_all" ON color_votes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
