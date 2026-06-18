// Generates a short-lived token that lets the browser upload directly to
// Vercel Blob storage, bypassing this serverless function's request-body
// size limit entirely (~4.5MB on most plans). This is used for can-wall
// photo uploads so people can keep full, uncompressed quality without
// risking 413 errors.
//
// Flow: browser calls upload() from "@vercel/blob/client", which POSTs here
// first to get a signed token (small JSON body, no image data — the shared
// password travels inside clientPayload since the SDK doesn't forward custom
// headers to handleUploadUrl), then uploads the actual file bytes straight
// to Blob storage.
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const expected = process.env.CANVAULT_PASSWORD;
  if (!expected) return res.status(500).json({ error: "CANVAULT_PASSWORD not set" });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: "BLOB_READ_WRITE_TOKEN not set" });

  try {
    const { handleUpload } = await import("@vercel/blob/client");
    const body = req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Auth check — clientPayload carries the shared password since the SDK
        // doesn't pass through arbitrary custom headers to this endpoint.
        let auth;
        try { auth = JSON.parse(clientPayload || "{}").auth; } catch { auth = null; }
        if (auth !== expected) throw new Error("Unauthorized");

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: 25 * 1024 * 1024, // 25MB — generous ceiling for full-quality wall photos
        };
      },
      onUploadCompleted: async () => {
        // No-op: the client receives the resulting blob URL directly and
        // saves it to Supabase itself, same as the existing upload flow.
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error("Client upload token error:", err);
    return res.status(400).json({ error: err.message });
  }
}
