// api/list-blobs.mjs — Vercel Serverless Function
// Returns all files stored in Vercel Blob for orphan detection
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-canvault-auth");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers["x-canvault-auth"];
  const expected = process.env.CANVAULT_PASSWORD;
  if (!expected || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { list } = await import("@vercel/blob");
    const allBlobs = [];
    let cursor;

    // Paginate through all blobs
    do {
      const result = await list({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        limit: 1000,
        cursor,
      });
      allBlobs.push(...result.blobs);
      cursor = result.cursor;
    } while (cursor);

    return res.status(200).json({
      blobs: allBlobs.map(b => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: "List failed: " + err.message });
  }
}
