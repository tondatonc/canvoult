// api/init-pinned.mjs
// Call this once at /api/init-pinned to create the pinned table in Supabase.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "Missing env vars" });

  // Use Supabase SQL endpoint
  const r = await fetch(`${url}/rest/v1/`, {
    method: "GET",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  // Create table via pg REST — use the SQL editor approach through management API
  const sql = `
    CREATE TABLE IF NOT EXISTS pinned (
      can_id TEXT NOT NULL,
      type   TEXT NOT NULL DEFAULT 'can',
      PRIMARY KEY (can_id, type)
    );
    ALTER TABLE pinned ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'pinned' AND policyname = 'allow_all'
      ) THEN
        CREATE POLICY "allow_all" ON pinned FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `;

  const resp = await fetch(`${url}/rest/v1/rpc/query`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await resp.text();
  res.status(200).json({ status: resp.status, body: text });
}
