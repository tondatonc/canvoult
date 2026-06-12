# CanVault — Claude Context File
Last updated: June 2026

This file gives Claude full context so it can help without recalling the entire chat.

---

## Project Overview

**CanVault** — a personal soda can collection web app.
- Owner: Tonda (tondatonc@gmail.com)
- Collects physical soda cans — 270+ and growing
- Lives at: **canvault.vercel.app**
- GitHub: **github.com/tondatonc/canvoult**

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, React Router v6 |
| Database | Supabase (PostgreSQL via REST) |
| Image storage | Vercel Blob |
| Hosting | Vercel (auto-deploys on GitHub push) |
| Language | JSX, no TypeScript |

---

## File Structure

```
src/
  App.jsx       — entire frontend (~2500 lines), all components and pages
  db.js         — Supabase database layer (all DB calls go through here)
  countries.js  — world country list, resolveCountry(), flagUrl(), COUNTRY_LIST
  main.jsx      — entry point, wraps app in BrowserRouter
api/
  upload.mjs    — Vercel serverless function: receives image → uploads to Blob
  delete.mjs    — Vercel serverless function: deletes image from Blob
public/
  can.svg       — favicon (red can SVG)
index.html      — single HTML, React mounts into <div id="root">
package.json    — dependencies including react-router-dom, @vercel/blob
vercel.json     — rewrites all routes to index.html (critical for React Router)
CLAUDE.md       — this file (lives in src/)
```

---

## Pages & Routes

| URL | Component | Description |
|---|---|---|
| `/` | CollectionPage | Main can grid/list, search, tag + country filters |
| `/wishlist` | WishlistPage | Cans to find, country filter, price/note fields |
| `/canwall` | CanWallPage | Photo gallery of shelves/display wall |
| `/stats` | StatsPage | Growth chart, brand breakdown, export JSON, Blob migration |
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
  added_at TIMESTAMPTZ DEFAULT NOW()
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

RLS enabled on all tables. Public read + write policies. GRANTs to anon + authenticated.

---

## Environment Variables (set in Vercel dashboard)

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` — NO trailing slash, NO /rest/v1/ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (starts with eyJ...) |
| `BLOB_READ_WRITE_TOKEN` | Auto-added when Blob store connected in Vercel Storage tab |
| `CANVAULT_PASSWORD` | Plain text admin password |

**Important**: after changing env vars, must redeploy manually in Vercel dashboard.

---

## Authentication

- Password stored as base64 in App.jsx line ~9: `const _PH = "c29kYWNhbjEyMw=="`
- `checkPw(pw)` decodes with `atob(_PH)` and compares
- Upload API sends `x-canvault-auth: atob(_PH)` header, server checks vs `CANVAULT_PASSWORD`
- To change password: run `btoa("newpassword")` in browser console, update `_PH` AND Vercel env var
- Not bank-level security — fine for personal use

---

## Key Components in App.jsx

| Component | Purpose |
|---|---|
| `CanSvg` | SVG placeholder can drawn in code, colored by brand tag |
| `FlagImg` | `<img>` from flagcdn.com — works on Windows (flag emoji don't) |
| `CountryInput` | Multi-country input with Google-style autocomplete dropdown |
| `TagPill` | Tag badge with optional count badge and remove button |
| `SortBar` | Sort buttons + Grid/Tile switcher, accepts `L` prop for i18n |
| `CropModal` | Crop UI: ratio presets (330ml, 250ml, 500ml etc), live KB size indicator, magnifier showing corner under finger |
| `BulkUploadModal` | Multi-photo upload: per-item crop, name edit, tags, shared tags |
| `BulkTagModal` | Select multiple cans → add or remove tags in bulk |
| `TagColorModal` | Assign colors to tags: hex input field + color swatches + native picker |
| `DetailModal` | Can detail: image, tags, country flags, share link, duplicate, edit, delete |
| `WishDetailModal` | Wishlist item detail: "✅ Found it!" with optional image replace step before moving to collection |
| `AddEditModal` | Add/edit can form: crop, camera/gallery buttons, tags (with autocomplete from existing tags), countries, price, note |
| `MigrateBlobTool` | In StatsPage — moves root-level Blob images into collection/ folder |
| `LoadingSpinner` | Spinning 🥤 while Supabase fetches |

---

## Internationalisation (i18n)

Czech mode toggle (🇨🇿 button in header). State: `const [cz, setCz] = useState(false)`
`L` object contains all UI strings in EN or CZ. Passed as prop to all page/modal components.
When adding new UI text, always use `L.keyName || "English fallback"` pattern.
Czech strings cover: navigation, sort labels, filter labels, buttons, empty states, error messages, placeholders, footer.

---

## Brand Colors

Built-in `BRAND_COLORS` in App.jsx:
```js
"coca-cola": "#C8102E",
fanta: "#FF6B00",
sprite: "#00843D",
pepsi: "#004B93",
"7up": "#00A651",
"mountain-dew": "#97D700",
"dr-pepper": "#7B1818",
"red-bull": "#C8A900"
```

Custom colors stored in `localStorage` key `cv_tag_colors`.
`getCanColor(tags, customColors)` — checks custom first, then built-in, then default red.
Used for: can card glow, card border on hover, SVG placeholder color.
Brand count in Stats includes both built-in AND custom colored tags.

---

## Image Upload Flow

1. User picks photo → `CropModal` opens (can ratio presets: 330ml=66×122, 250ml=53×135, 500ml=66×168 etc)
2. Crop confirmed → compress: cans target ~150KB/900px, wall photos target ~3.8MB/4K
3. POST to `/api/upload` with password header
4. `upload.mjs`: checks password → `put()` to Vercel Blob → returns public URL
5. URL + metadata saved to Supabase via `db.upsertCan()`
6. On delete: `/api/delete` removes from Blob, `db.deleteCan()` removes from Supabase

Blob folder structure:
- `collection/timestamp.jpg` — can photos
- `wishlist/timestamp.jpg` — wishlist photos
- `wall/timestamp.jpg` — wall/shelf photos

---

## Country System

- All data in `src/countries.js` (separate file, not in App.jsx)
- ~250 countries, format: `{ "cze": ["cz", "Czech Republic"], ... }`
- `resolveCountry(raw)` accepts: 3-letter codes (`cze`, `aut`), full names, already-resolved names
- **Bug fixed**: checks exact 3-letter match FIRST, then full name match — prevents `"Austria"` → stripping to `"aus"` → matching Australia
- `FlagImg` component uses `https://flagcdn.com/20x15/{iso2}.png` — works on all platforms
- Countries stored as `TEXT[]` array in Supabase — one can can have multiple countries
- Auto-expand: when detail modal opens with 3-letter code, silently saves expanded name back to DB
- Country filter appears in both Collection and Wishlist pages when any item has countries set
- Wishlist also has country filter for "where can I find this can"

---

## Features List

**Collection page:**
- Grid view (image dominant, slim name bar) + Tile/list view
- Search by name or tag
- Tag filter with count badges (e.g. #fanta 12)
- Country filter with flags
- Sort: newest/oldest/A-Z/Z-A
- **Filter/sort state synced to URL** — shareable filtered views e.g. `/?tag=fanta&sort=az`
- Pin cans to top (stored in localStorage)
- 🎲 Random can button
- 📦 Bulk upload (multi-photo with per-item crop + tags)
- 🏷️ Bulk tag edit (select cans → add/remove tags in one action)
- 🎨 Tag color manager
- Deep link sharing: `/?can=ID`

**Wishlist page:**
- All collection filters plus country filter
- Price field, note field, country field
- "✅ Found it!" button — two-step: optionally replace placeholder photo before moving to collection
- Mark as found preserves image (or new photo), tags, note, countries

**Can Wall page:**
- Photo gallery of physical shelves/display
- Crop + caption per photo
- Lightbox fullscreen view

**Stats page:**
- Total cans, wishlist count, unique tags, brand count
- **📅 On This Day** — shows cans added on today's date in previous years
- Monthly growth bar chart
- Brand breakdown with colored bars
- Top tags chart
- Export full collection as JSON backup
- Blob migration tool (moves root-level images to folders)

**Add/Edit modal:**
- Tag autocomplete — suggests existing tags as you type, prevents duplicates like `fanta` vs `Fanta`

**Crop modal:**
- Ratio presets: 330ml, 330ml Sleek, 250ml (Red Bull), 500ml, 500ml Sleek, 1:1
- Live file size indicator (green/orange/red vs target)
- Magnifier showing corner under finger (no zoom, 1:1 peek)
- 8 resize handles with 44px invisible touch targets
- Ratio-locked resizing expands from center

**Bulk upload:**
- Shared tags applied to all cans
- Per-item: name (pre-filled from filename), individual tags, crop button
- Upload all at once with progress bar
- Can retry failed items

---

## Pinned Cans

`localStorage` key `cv_pinned` — JSON array of IDs.
Pinned cans always appear first regardless of sort order.
Pin button (📌) shown on grid cards when admin is signed in.

---

## Themes

**Light mode** (default): cream/warm tones #FFF5E6, red accent #C8102E, retro diner aesthetic
**Dark mode**: deep navy #060d18, blue-tinted cards #0a1525 — NOT the old red/black

Theme object `T` passed as prop to all components.
Contains: bg, bgCard, bgInput, border, text, textMuted, textFaint, stripe, isDark.

---

## Known Issues / Gotchas

- `vercel.json` MUST have `/(.*) → /index.html` rewrite or refreshing any sub-route gives 404
- `VITE_SUPABASE_URL` must NOT end with `/rest/v1/` — code adds that itself
- Windows doesn't render flag emoji — always use `<FlagImg>` component, never emoji flags
- After adding env vars in Vercel, must redeploy or they won't take effect
- Supabase May 2026 change: new tables need explicit GRANTs — run grant SQL after creating tables
- The old `country` (single TEXT) column still exists in DB alongside new `countries` (TEXT[])
- `saveCan` has `closeModal` and `refetch` options — bulk upload uses `{ closeModal: false, refetch: false }`
- URL filter sync uses `skipUrlSync` ref to avoid conflicting with `?can=ID` deep links on initial load

---

## Useful SQL

```sql
-- Add missing columns
ALTER TABLE cans ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE cans ADD COLUMN IF NOT EXISTS price TEXT;
ALTER TABLE cans ADD COLUMN IF NOT EXISTS countries TEXT[] DEFAULT '{}';
ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS price TEXT;
ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS countries TEXT[] DEFAULT '{}';

-- Grants (run after any new table)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_photos TO authenticated;

-- Migrate single country → array
UPDATE cans SET countries = ARRAY[country] WHERE country IS NOT NULL AND country != '' AND (countries IS NULL OR countries = '{}');
UPDATE wishlist SET countries = ARRAY[country] WHERE country IS NOT NULL AND country != '' AND (countries IS NULL OR countries = '{}');
```

---

## How to Work With This Codebase

- **All UI is in `src/App.jsx`** — one big file by design
- **Never use localStorage for shared data** — use Supabase via db.js
- **Always use `<FlagImg>` not flag emoji** for country flags
- **All text strings go through `L` object** — add both EN and CZ versions
- **Compression**: cans use `compressCanPhoto()`, wall uses `compressWallPhoto()`, no compression for wishlist
- **After editing**: copy file to GitHub → Vercel auto-deploys in ~45 seconds
- **Claude can push to GitHub** using token stored in session (ask Claude to push)
- **Tag autocomplete**: `AddEditModal` accepts `allTags` prop — always pass it from the parent page
- **BulkTagModal**: takes full `cans` array + `onSave(updatedCans[])` — saves each can then refetches
