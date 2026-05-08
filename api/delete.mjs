// api/delete.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-canvault-auth");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers["x-canvault-auth"];
  const expected = process.env.CANVAULT_PASSWORD;
  if (!expected || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { del } = await import("@vercel/blob");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body.url) return res.status(400).json({ error: "Missing url" });
    await del(body.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Delete failed: " + err.message });
  }
}
