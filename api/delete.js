// api/delete.js — Vercel Serverless Function for deleting blobs
import { del } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers["x-canvault-auth"];
  const expected = process.env.CANVAULT_PASSWORD;
  if (!expected || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { url } = req.body ? JSON.parse(await readBody(req)) : {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Delete failed: " + err.message });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
