# CanVault — Claude Context File
Last updated: June 2026

Live: canvault.vercel.app | Repo: github.com/tondatonc/canvoult

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, React Router v6 |
| Database | Supabase (PostgreSQL via REST) |
| Image storage | Vercel Blob |
| Hosting | Vercel (auto-deploys on GitHub push) |

---

## File Structure

```
src/
  App.jsx       — entire frontend (~2850 lines), all components and pages
  db.js         — Supabase database layer
  countries.js  — world country list, resolveCountry(), flagUrl(), COUNTRY_LIST
  main.jsx      — entry point
api/
  upload.mjs    — Vercel serverless: receives image → uploads to Blob
  delete.mjs    — Vercel serverless: deletes image from Blob
  list-blobs.mjs — Vercel serverless: lists all Blob files (for orphan cleanup)
public/
  can.svg       — favicon
index.html
vercel.json     — rewrites all routes to index.html (critical for React Router)
CLAUDE.md       — this file
```

---

## Pages & Routes

| URL | Component | Description |
|---|---|---|
| `/` | CollectionPage | Main can grid/list, search, tag + country filters |
| `/wishlist` | WishlistPage | Cans to find |
| `/canwall` | CanWallPage | Photo gallery of shelves |
| `/stats` | StatsPage | Growth chart, migration tools, export |
| `/?can=ID` | CollectionPage | Deep link — auto-opens specific can detail modal |

---

## Supabase Tables

```sql
cans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  price TEXT,
  countries TEXT[] DEFAULT '{}',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  date_unknown BOOLEAN DEFAULT false
)

wishlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  price TEXT,
  countries TEXT[] DEFAULT '{}',
  added_at TIMESTAMPTZ DEFAULT NOW()
)

wall_photos (
  id TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## Environment Variables (Vercel dashboard)

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | No trailing slash, no /rest/v1/ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `BLOB_READ_WRITE_TOKEN` | Auto-added via Vercel Storage tab |
| `CANVAULT_PASSWORD` | Plain text admin password |

---

## Authentication

- Password stored as base64 in App.jsx: `const _PH = "..."`
- `checkPw(pw)` decodes with `atob(_PH)` and compares
- Admin state persisted to `localStorage` key `cv_admin` = "1"
- Upload/delete/list-blobs APIs check `x-canvault-auth` header vs `CANVAULT_PASSWORD` env var
- Sign-in persists across refreshes; sign-out clears localStorage

---

## Blob Storage Structure

```
collection/timestamp.jpg   — can photos
wishlist/timestamp.jpg     — wishlist photos
wall/timestamp.jpg         — wall/shelf photos
```

**Critical Blob URL gotcha:** Vercel Blob listing API returns URLs with `public.blob.vercel-storage.com` but Supabase may store `blob.vercel-storage.com` (no `public.` prefix). These are the same file. All URL matching must normalize by stripping the full hostname and comparing pathnames only.

**Blob renames files on upload** — the filename sent in `x-filename` gets a random suffix appended by Vercel (e.g. `collection/123.jpg` → `collection/123-AbCdEfGh.jpg`). This means you cannot reconstruct the Blob URL from the original filename.

**Migration history:** Early wishlist/can uploads went to Blob root (no folder). A migration tool in Stats moves them to the correct folders. A failed migration run left some wishlist items with Supabase URLs pointing to deleted root files — those show as "broken" in the broken image checker. Fix: re-upload photo on the wishlist item.

---

## Key Components in App.jsx

| Component | Purpose |
|---|---|
| `CanSvg` | SVG placeholder can, colored by brand tag |
| `FlagImg` | `<img>` from flagcdn.com (Windows-safe, no emoji) |
| `CountryInput` | Multi-country autocomplete |
| `TagPill` | Tag badge with optional count + remove |
| `SortBar` | Sort buttons + Grid/Tile switcher, uses L prop for i18n |
| `CropModal` | Crop with ratio presets, live KB indicator, magnifier |
| `BulkUploadModal` | Multi-photo upload with per-item crop |
| `BulkTagModal` | Select cans → add/remove tags in bulk |
| `TagColorModal` | Assign hex colors to tags |
| `DetailModal` | Can detail: image, tags, countries, share, duplicate, edit, delete |
| `WishDetailModal` | Wishlist detail: two-step "Found it!" with optional image replace |
| `AddEditModal` | Add/edit form: tag autocomplete, date picker, date-unknown checkbox |
| `MigrateBlobTool` | Moves root-level Blob images to correct folders; broken image checker |
| `OrphanCleanupTool` | Lists + deletes Blob files not referenced by any Supabase record |

---

## i18n (Czech/English)

Czech toggle (🇨🇿 button). `const [cz, setCz] = useState(false)` in root App.
`L` object passed as prop to ALL page/modal components — covers all UI strings.
Add both EN and CZ for every new string. Pattern: `L.keyName`.
`SortBar` uses `L.sortLabel`, `L.sortNewest`, `L.sortOldest`, `L.sortAZ`, `L.sortZA`, `L.gridView`, `L.tileView`.

---

## URL State (Filter Sync)

Both CollectionPage (`/`) and WishlistPage (`/wishlist`) sync filters to URL:
- `?q=` — search query
- `?tag=` — comma-separated active tags
- `?sort=` — newest/oldest/az/za (default: newest)
- `?view=` — grid/tile (default: grid)
- `?country=` — active country filter
- `?can=ID` — deep link (CollectionPage only), opens detail modal

`skipUrlSync` ref prevents the URL sync effect from conflicting with deep-link handling on initial load.

---

## Date System

Cans have `addedAt` (timestamp) and `dateUnknown` (boolean).
- `dateUnknown: true` → date stored in DB but never shown in UI; shows "📅 DATE UNKNOWN" instead
- AddEditModal has date picker (YYYY-MM-DD input) + "date unknown" checkbox
- "On This Day" in Stats skips dateUnknown cans

---

## Stats Page Tools

1. **🗂️ Blob Folder Migration** — detects images in Blob root (no folder), moves to `collection/`, `wishlist/`, or `wall/`. Also has **broken image checker** that HEAD-requests all Supabase image URLs in parallel and lists 404s.
2. **🗑️ Orphan Blob Cleanup** — lists all Blob files, cross-references against all Supabase image URLs (normalized to handle `public.blob` vs `blob` hostname difference), lets you delete unmatched files.

---

## Known Gotchas

- `vercel.json` MUST have `/(.*) → /index.html` rewrite
- `VITE_SUPABASE_URL` must NOT end with `/rest/v1/`
- Windows doesn't render flag emoji — always use `<FlagImg>`, never emoji flags
- Supabase May 2026: new tables need explicit GRANTs after creation
- `on_conflict` must go in `Prefer` header, not URL params
- Blob URL mismatch: listing API uses `public.blob.vercel-storage.com`, stored URLs may use `blob.vercel-storage.com` — normalize before comparing
- Blob renames uploaded files with random suffix — cannot match by filename
- `saveCan` has `closeModal`/`refetch` options — bulk upload uses `{ closeModal: false, refetch: false }`
- `skipUrlSync` ref needed to prevent URL sync conflicting with `?can=ID` deep links

---

## Useful SQL

```sql
-- Add missing columns
ALTER TABLE cans ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE cans ADD COLUMN IF NOT EXISTS price TEXT;
ALTER TABLE cans ADD COLUMN IF NOT EXISTS countries TEXT[] DEFAULT '{}';
ALTER TABLE cans ADD COLUMN IF NOT EXISTS date_unknown BOOLEAN DEFAULT false;
ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS price TEXT;
ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS countries TEXT[] DEFAULT '{}';

-- Grants (run after any new table)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_photos TO anon, authenticated;

-- Migrate single country → array
UPDATE cans SET countries = ARRAY[country] WHERE country IS NOT NULL AND country != '' AND (countries IS NULL OR countries = '{}');
UPDATE wishlist SET countries = ARRAY[country] WHERE country IS NOT NULL AND country != '' AND (countries IS NULL OR countries = '{}');
```

---

## Claude's Workflow

- Download source via GitHub API, edit locally, parse-check JSX with @babel/parser, push back via GitHub API
- Vercel auto-deploys ~45s after push
- Always update this CLAUDE.md when adding features or discovering gotchas
- GitHub token in project instructions
