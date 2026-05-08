// api/upload.js — Vercel Serverless Function
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-canvault-auth, x-filename");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers["x-canvault-auth"];
  const expected = process.env.CANVAULT_PASSWORD;
  if (!expected || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { put } = await import("@vercel/blob");
    const contentType = req.headers["content-type"] || "image/jpeg";
    const filename = req.headers["x-filename"] || `can-${Date.now()}.jpg`;

    // Read body as buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed: " + err.message });
  }
}
