// api/stats-export.mjs — read-only data export (Claude uses this to fetch
// collection data for statistical analysis / reporting). GET only, no
// mutation, mirrors data already visible in the public app UI.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "Missing env vars" });

  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    const [cansRes, tagMetaRes] = await Promise.all([
      fetch(`${url}/rest/v1/cans?select=name,tags,countries,avg_color,added_at,date_unknown`, { headers }),
      fetch(`${url}/rest/v1/tag_meta?id=eq.global&select=colors,roles`, { headers }),
    ]);
    if (!cansRes.ok) throw new Error("cans fetch failed: " + (await cansRes.text()));
    if (!tagMetaRes.ok) throw new Error("tag_meta fetch failed: " + (await tagMetaRes.text()));
    const cans = await cansRes.json();
    const tagMetaRows = await tagMetaRes.json();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ count: cans.length, cans, tag_meta: tagMetaRows[0] || null });
  } catch (err) {
    return res.status(500).json({ error: "Export failed: " + err.message });
  }
}
