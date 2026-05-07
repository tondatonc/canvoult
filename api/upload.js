// api/upload.js — Vercel Serverless Function
// This runs on the server, so BLOB_READ_WRITE_TOKEN stays secret.
import { put } from "@vercel/blob";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Simple password check — same password as the frontend
  const auth = req.headers["x-canvault-auth"];
  const expected = process.env.CANVAULT_PASSWORD;
  if (!expected || auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const contentType = req.headers["content-type"] || "image/jpeg";
    const filename = req.headers["x-filename"] || `can-${Date.now()}.jpg`;

    const blob = await put(filename, req, {
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
