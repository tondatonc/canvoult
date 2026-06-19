# CanVault — Claude Context File
Last updated: June 19, 2026

Live: canvault.vercel.app | Repo: github.com/tondatonc/canvoult

---

## Credentials & Access

| Service | Value |
|---|---|
| GitHub token | stored in Claude project memory (not committed) |
| Supabase URL | https://nvqckeaulnmkmbllubck.supabase.co |
| Supabase service role key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cWNrZWF1bG5ta21ibGx1YmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE3MTkwOCwiZXhwIjoyMDkzNzQ3OTA4fQ.plNf3CTAg6zBHEMtDIESRxZ27SfEbfqs79gDC3IOgzM |

**Note:** Claude's bash sandbox cannot reach `supabase.co` directly (not in egress allowlist). Supabase access must go through the app's existing Vercel API endpoints, or via the Supabase SQL editor in the dashboard. GitHub API (`api.github.com`) works fine from bash.

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


## Crop Modal — Known Issues & Fixes (June 2026)

- **Transparent PNG black background**: Canvas toBlob with image/jpeg flattens alpha to black. Fix: fill white before drawImage in both doCrop and compressCanPhoto.
- **Default crop box auto-trimming**: Was x:0.1, y:0.1, w:0.8, h:0.8 (cropped 10% off each edge). Fixed to x:0, y:0, w:1, h:1 (full image selected by default).
- **Tall image overflow in crop modal**: No height limit on crop area. Fixed with maxHeight:55vh on crop-area div and img element.

## Auto-crop transparent PNGs (June 2026)

When the crop modal loads a PNG with transparency, it scans pixel alpha values via an offscreen canvas and automatically sets the crop box to the tightest bounding box of non-transparent pixels (alpha >= 10), with 2px padding. Falls back to full image if no transparency is detected or if canvas throws (cross-origin etc). Logic is in the img onLoad handler inside CropModal.

## Bulk Upload — Country + Date fields (June 2026)

Added shared country and date controls to BulkUploadModal:
- SHARED section now has: Tags, Country (multi, type + Enter/+), Date (date picker or "Unknown Date" checkbox)
- Queue items initialised with countries/dateUnknown/date from shared state
- onSave passes countries, dateUnknown, addedAt correctly to saveCan
- Changing shared controls after files are picked propagates to all non-done items

## Transparent PNG auto-crop — all modals (June 2026)

originalFile prop now passed to CropModal from all call sites:
- AddModal: pendingFile
- FoundItModal: pendingFoundFile
- EditModal/WallPhoto: pendingEditFile
- BulkUpload: queue[cropIdx].file
CropModal uses originalFile (if PNG) to scan raw alpha before JPEG conversion.

## Bulk Upload — Tag & Country Autocomplete (June 2026)

- BulkUploadModal now accepts allTags prop (passed from call site)
- Shared tag input has dropdown autocomplete (same style as AddEditModal) — filters allTags, ArrowDown selects first, Escape closes
- Shared country input replaced with the existing CountryInput component — full flag + name autocomplete from COUNTRY_LIST
- CountryInput onChange diff logic: detects added/removed country and propagates to all non-done queue items


## Recently Implemented Features (June 2026)

### Bulk Upload Improvements
- **Auto-crop**: When photos are selected for bulk upload, the crop modal automatically opens for each photo sequentially. After cropping one, the next opens automatically. Manual crop button (✂️) still available if needed.
- **Per-item date editors**: Each can in the bulk upload queue has its own date/unknown-date control inline. "APPLY TO ALL" button copies a per-item date to all remaining cans.

### Bulk Edit Modal (was "Bulk Tags", now "Bulk Edit")
- **Countries bulk add**: New 🌍 COUNTRIES TO ADD section using CountryInput — adds selected countries to all selected cans.
- **Tag filter for can list**: 🔍 FILTER LIST BY TAG section — tap tags to narrow the visible can list. "SELECT VISIBLE" selects only filtered cans. Useful for bulk-editing a subset (e.g., all cans tagged "330ml").
- `onSave` now includes updated `countries` field.

### BulkTagModal signature
```jsx
<BulkTagModal T={T} cans={cans} onSave={async (updatedCans) => { ... }} onClose={() => setModal(null)} />
```


## Session: June 2026 — UI Polish + Bulk Features

### UI Changes (applied to App.jsx)
- **Dark mode removed**: `dark` state and `setDark` deleted. `T` object is now always light (`isDark: false`, bg `#ffffff`).
- **White background**: `T.bg` is `#ffffff` (was warm cream `#FFF5E6`).
- **No glow**: `textShadow` removed from h1 title and header logo.
- **No email**: `tondatonc@gmail.com` footer link removed.
- **Logo → Home button**: The `🥤 CanVault` header logo is now a `<button onClick={() => navigate("/")} ...>` that navigates to the main collection page.
- **Bigger can cards**: Collection and wishlist grids use `minmax(190px,1fr)` (was 155px).
- **Admin-only export/quirk tools**: `StatsPage` now accepts `isAdmin` prop. Export JSON, MigrateBlobTool, OrphanCleanupTool are wrapped in `{isAdmin && ...}`.

### Bulk Upload Improvements
- **Auto-crop**: On `handleFiles`, all item indices are pushed to `autoCropQueue`. A `useEffect` watches `[cropIdx, autoCropQueue]` and auto-opens the crop modal for the next item after each crop is confirmed.
- **Per-item date editors**: Each queue item has inline date/unknown controls stored in `perItemDates` state `{idx: {date, dateUnknown}}`. "APPLY TO ALL" button copies a date to `sharedDate` and all non-done items. Upload uses per-item date with fallback to item/shared date.

### Bulk Edit Modal (was "Bulk Tags")
- Title changed to "Bulk Edit", button label updated.
- **🌍 Countries to add**: `applyCountries` state + `CountryInput` component. Countries are merged (not replaced) into selected cans on save.
- **Tag filter for can list**: `filterTags` state. Clicking a tag in "FILTER LIST BY TAG" section narrows the visible can list. "SELECT VISIBLE" / "DESELECT VISIBLE" toggles only filtered cans.
- `onSave` handler now includes updated `countries` array.

### Key state in BulkUploadModal
```
autoCropQueue: number[]    // indices pending auto-crop
perItemDates: {[idx]: {date?, dateUnknown?}}
```

### Key state in BulkTagModal
```
applyCountries: string[]
filterTags: string[]
visibleCans: Can[]         // derived from filterTags
```


## Session: June 2026 — Collection Page Layout & Card Polish

### Layout reorder (CollectionPage)
New order: Search → **Toolbar (tools + count)** → Tag filter → Country filter → Sort+View → Grid

Previously: Search → Tags → Sort → Countries → Stats+Buttons → Grid

### Toolbar
- Random, Bulk, Bulk Edit, Colors, + Add Can all appear first in a flex row
- Can count / "showing X of Y" moved to the right via `marginLeft: "auto"`
- Clear filters link appears inline next to count when filters are active

### Tag sort toggle
- New `tagSortMode` state (`"alpha"` | `"count"`) in CollectionPage
- Small toggle button `[A→Z]` / `[#]` in the tag filter header — toggles between alphabetical and most-used-first
- `allTags` derived array respects sort mode

### Grid card changes
- Grid uses `repeat(3, 1fr)` — always 3 columns on any screen width
- GridCard background: `#ffffff` (pure white, no cream)
- GridCard border: `#e8e0d8` (subtle warm grey, not the bold cream border)
- GridCard box-shadow: `0 2px 8px #0000000a` (very subtle, no glow)
- GridCard image area background: `#f8f6f3` (off-white, distinct from page white)


## Session: June 2026 — Layout Polish & Dashed Line Removal

### Removed dashed separator lines
- Collection page toolbar row: `borderBottom: 2px dashed` removed
- Wishlist page stats/add row: `borderBottom: 2px dashed` removed
- These were ugly visual dividers with no semantic value

### Wishlist page reordered to match collection
New order: **Toolbar (+ Add Wish · count · clear)** → **Tag filter** → **Country filter** → **Sort + View**
Previously: SortBar first, then countries, then tags, then count/add with dashed line

### Wishlist country filter: flag images added
`FlagImg` component now used in wishlist country buttons (was missing, only collection had it)

### Card style consistency
- `WishGridCard`: `background #ffffff`, `border 2px solid #e8e0d8`, `boxShadow 0 2px 8px #0000000a`
- `WishTileCard`: `background #ffffff`, `border 1.5px solid #e8e0d8`, `boxShadow 0 2px 8px #0000000a`
- Both cards use warm hover: border → `#C8102E`, shadow → `0 10px 26px #C8102E22`
- Wishlist grid: `repeat(3, 1fr)` — 3 columns, matches collection grid


## Session: June 2026 — Pins→DB, Wishlist Pins, Sort, Stripe Removal

### Supabase: pinned table
```sql
CREATE TABLE IF NOT EXISTS pinned (
  can_id TEXT NOT NULL,
  type   TEXT NOT NULL DEFAULT 'can',
  PRIMARY KEY (can_id, type)
);
ALTER TABLE pinned ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON pinned FOR ALL USING (true) WITH CHECK (true);
```
**IMPORTANT**: This table must exist in Supabase. Run the SQL above in the Supabase dashboard SQL editor if pins aren't working. A one-shot API endpoint `api/init-pinned.mjs` was also added (call `/api/init-pinned` once after deploy).

### db.js changes
- Added `getPinned()` — returns all rows from `pinned` table
- Added `pinItem(id, type)` — inserts row, type = 'can' | 'wish'
- Added `unpinItem(id, type)` — deletes row

### App.jsx: collection pinning
- `pinned` state now initialised as `[]` (no longer from localStorage)
- `localStorage cv_pinned` sync effect removed
- `getCans` useEffect now `Promise.all([getCans(), getPinned()])` — loads both together
- `togglePin` is now async, calls `db.pinItem`/`db.unpinItem`, reverts on error

### App.jsx: wishlist pinning (new)
- `pinnedWishes` state + `togglePinWish` async function added to WishlistPage
- `getWishlist` effect upgraded to `Promise.all([getWishlist(), getPinned()])`
- `sorted` = pinned wishes first, then rest sorted normally
- `WishGridCard` / `WishTileCard` accept `pinned` + `onPin` props
- Pin button (📍/📌) shown in top-left of grid card and inline in tile card

### Sort options extended
New options added to `sortCans()` and SortBar:
- `brand` — sorts by first word of name (case-insensitive)
- `price_asc` / `price_desc` — parses numeric price, nulls last
- `countries` — most countries first
Helper functions: `extractBrand(name)`, `parsePrice(price)`
L string keys added: `sortBrand`, `sortPriceAsc`, `sortPriceDesc`, `sortCountries`

### Stripe removal
- `T.stripe` value changed from repeating gradient to `"#f0ece6"` (flat warm grey)
- `ModalShell` background: removed `backgroundImage: T.stripe`, now plain `#ffffff`
- All `background: T.stripe` references replaced with `background: "#f0ece6"` (8 occurrences)
- Edit modal / add modal no longer have visible stripe pattern


## Session: June 2026 — Pinned→DB, Stripes, Sort, Wishlist Pin

### Critical bug fixed: cans showing as placeholders
**Root cause**: `getPinned()` threw an error when the `pinned` table didn't exist yet.
This caused `Promise.all([getCans(), getPinned()])` to reject, falling into the `.catch()` which set `SAMPLE_CANS`.
**Fix**: Load cans first with `db.getCans().then(...)`, then load pinned separately in a non-fatal `.catch(() => {})` block. Same pattern in WishlistPage.

### pinned table (Supabase)
Must be created manually in Supabase SQL editor (see `supabase/migration_pinned.sql`):
```sql
CREATE TABLE IF NOT EXISTS pinned (
  can_id text NOT NULL,
  type   text NOT NULL DEFAULT 'can',
  PRIMARY KEY (can_id, type)
);
ALTER TABLE pinned ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all" ON pinned FOR ALL USING (true) WITH CHECK (true);
```
`type` is either `'can'` or `'wish'` — one table for both.
db.js exports: `getPinned()`, `pinItem(id, type)`, `unpinItem(id, type)`

### Pinned cans: localStorage → Supabase
- `pinned` state no longer uses localStorage
- `togglePin()` calls `db.pinItem` / `db.unpinItem` with optimistic update + revert on error
- Pins are now cross-device

### Wishlist pinning
- `pinnedWishes` state in WishlistPage, same DB pattern
- `togglePinWish()` handler
- Pinned items float to top of wishlist (sorted separately, prepended)
- `WishGridCard` and `WishTileCard` accept `pinned` + `onPin` props
- Pin button (📍/📌) shown for admin users only

### New sort options (both collection + wishlist)
- Brand (first word of name, alphabetical)
- Price ↑ / Price ↓ (parsed from price field, items without price go last)
- Countries (most countries first)
- `extractBrand(name)` and `parsePrice(p)` helper functions added before `sortCans()`
- L strings added: `sortBrand`, `sortPriceAsc`, `sortPriceDesc`, `sortCountries`

### Stripes fully removed
- `T.stripe` definition changed to plain `"#f8f5f0"` solid color
- ModalShell: `backgroundImage: T.stripe` removed → `background: "#ffffff"`
- Hero/page band: `background: T.stripe` → `background: "#f8f5f0"`
- Nav header: `backgroundImage: repeating-linear-gradient(90deg,...)` removed
- All remaining `T.stripe` references replaced with `#f8f5f0`


## Session: June 2026 — Grid zoom, tag search/roles, bulk auto-crop, wall upload 413 fix, underglow removed

### Grid layout modes + zoom
- `viewMode` now has 4 states: `"grid5"`, `"grid3"` (default), `"grid2"`, `"tile"` (was just `"grid"`/`"tile"` before). Old `?view=grid` URLs/bookmarks map to `grid3` on load for backward compatibility.
- `GRID_MODES` constant array defines zoom order (`grid5 → grid3 → grid2 → tile`).
- `SortBar` renders 4 grid-mode buttons + a `−`/`+` zoom button pair that step through `GRID_MODES`.
- `makeGridZoomWheelHandler(viewMode, setViewMode)` — Ctrl/Cmd+scroll-wheel over the grid area cycles zoom levels. Wired via `onWheel` on a wrapper div around the grid/tile render block in both `CollectionPage` and `WishlistPage`.
- `GridCard` / `WishGridCard` accept a `hideLabel` prop — true when `viewMode === "grid5"`, hides the name label under the can image.

### Tag search + tag roles ("size" tags) + brand-color verification (v1, later redesigned — see next session)
- `loadTagRoles()` / `saveTagRoles()` — localStorage helpers (`cv_tag_roles` key) storing a `{tag: "size"}` map.
- Tag search input + count-sort tie-break fix (`(tagCounts[b]||0) - (tagCounts[a]||0) || a.localeCompare(b)`).
- New sort option `"tag"` added to `sortCans()` — sorts by first tag alphabetically.

### Bulk upload — silent PNG auto-crop, manual recrop only on click
- New helper `autoCropToOpaqueBounds(file)`: for PNG files, scans pixel alpha channel to find the bounding box of non-transparent content, crops to it via canvas, returns a new PNG `File`. Falls back to the original file for non-PNGs, fully-transparent images, already-tight images, or canvas errors.
- `BulkUploadModal.handleFiles` no longer queues every image into a forced `CropModal` popup. Each file is silently auto-cropped in the background; `croppedFile`/`croppedUrl`/`autoCropped` update per-item as each finishes.
- The old `autoCropQueue` state + `useEffect` that popped `CropModal` per-item was deleted. The modal now ONLY opens when the user clicks the ✂️ button on a thumbnail (`setCropIdx(i)`).
- Thumbnails show a green "AUTO" badge when `item.autoCropped` is true.

### Wall upload 413 errors — root cause + fix (v1 — compression-based; later superseded by direct client upload, see next session)
**Root cause**: Vercel serverless functions enforce a hard ~4.5MB request body limit at the infra level (413 before the function code runs). `compressWallPhoto()` existed but was never called; `CropModal` alone targeted 3.9MB, too close to the ceiling.
- v1 fix: lowered crop/compress targets to ~2.2MB and actually called `compressWallPhoto()` before upload. (Superseded — see "Full-quality wall uploads" below.)

### Bug fixed: OrphanCleanupTool was missing wallPhotos
`OrphanCleanupTool` only ever received `cans`/`wishes` as known-URL sources, never `wallPhotos` — meaning every successfully-uploaded wall photo would scan as "orphaned" and be offered for deletion.
- Fixed by passing `wallPhotos={wallPhotos}` into `<OrphanCleanupTool>` in `StatsPage`, with `wallPhotos = []` default, included in both `knownNormalized`/`knownPathnames` sets.
- **If orphan cleanup ever ran before this fix, deleted wall photos cannot be recovered.**

### Underglow removal (v1 — grid cards only; detail modals missed, fixed next session)
Removed the `radial-gradient(ellipse at 50% 30%, ${color}22 ...)` wash from `GridCard`/`WishGridCard`. (The `CanDetailModal`/`WishDetailModal` still had a colored `drop-shadow` version of the same effect — missed in this pass, fixed in the next session below.)


## Session: June 2026 — Brand/Size tag sections, Tag Studio redesign, borderless grid5, full-width grid, full-quality wall uploads, Bebas Neue can names

This session started with a full **re-audit of every requirement from the previous session** against live screenshots — everything from grid zoom/sort/tag-search/size-roles/brand-verification/bulk-auto-crop/wall-413-fix/OrphanCleanupTool was confirmed working correctly in production. Two things were found broken on re-audit and fixed first:

### Underglow — actually fully removed now
Found that `CanDetailModal` (line ~991 area) and `WishDetailModal` still had `filter: drop-shadow(0 10px 24px ${color}66)` / `drop-shadow(0 8px 20px ${color}55)` on the can image — a colored-glow effect equivalent to the radial-gradient removed from grid cards last session, just expressed differently, and missed in that earlier sweep. Confirmed visually from a user screenshot (pink blur around the can image and title pill in the detail modal). Both replaced with neutral `drop-shadow(0 8px 18px #00000022)` (no tag-color tint at all). The tile-mode (`TileCard`) hover border/shadow color tint was deliberately left as-is — it's a minor hover-only interaction, not a static underglow.

### Brand / Other / Size — three-way tag section split (filter UI, not just Tag Studio)
Previously the main tag filter row only separated "size" tags from everything else; brand tags (anything with a color) were mixed in with uncategorized tags. Now both `CollectionPage` and `WishlistPage` compute three groups:
- `brandTagsAll` — role !== "size" AND has a color (custom or `BRAND_COLORS`)
- `otherTagsAll` — role !== "size" AND no color
- `sizeTagsAll` — role === "size"
Each is independently filtered by the tag-search input. The filter UI renders three labeled rows: **BRAND** (`L.brandTagsLabel`) → **OTHER** (`L.otherTagsLabel`, label only shown if brand or size tags exist, to avoid clutter when everything is "other") → **SIZE** (`L.sizeTags`). A single "clear" link next to the search box clears `activeTags` across all three groups at once (moved up from below the tag rows). `customColors` is read via `loadCustomColors()` in `WishlistPage` (it didn't have a colors-state before); `CollectionPage` reuses its existing `customColors` state (was almost double-declared — watch for this if touching that area again).

### Tag Studio — full redesign of the tag color/role modal
Renamed from "Tag Colors" to **"Tag Studio"** with a tabbed layout (`COLORS` / `SIZE ROLES`) instead of 5 stacked full-width sections, to fix the cluttered/dense look from the screenshots. Key changes:
- Tabs replace the old vertical stack of ADD/CUSTOM COLORS/BUILT-IN BRANDS/BRAND TAGS/SIZE TAGS sections — `COLORS` tab holds add-new-color form + your brands list + suggested built-ins + an orange "N tags still without a color or size role" verification banner (replaces the old separate green-checkmark "BRAND TAGS" list, which was redundant with "your brands" — the warning banner alone is the useful signal). `SIZE ROLES` tab holds just the tag-role toggle chips.
- New `SectionLabel` and `TabBtn` sub-components for consistent typography or hierarchy instead of repeating inline uppercase `<p>` tags everywhere.
- Add-color form: tag-name input + hex field + swatches grouped more compactly with a colored circle preview; swatch picker now shows a focus ring (`0 0 0 2px #fff, 0 0 0 4px ${c}`) instead of a solid border swap.
- "Your brands" list rows are flatter (single row: swatch dot, tag name, swatch-picker, hex field, × remove) instead of the old two-row card-per-tag layout.
- Still saves both `customColors` (via `saveCustomColors`) and `tagRoles` (via `saveTagRoles`) on the single "SAVE" button — same persistence as before, just restyled.

### 5-per-row grid — borderless, compact look
`GridCard`/`WishGridCard` now branch their entire card style on `hideLabel` (true only in `grid5` mode): no border, no border-radius beyond a small 6px, no box-shadow, transparent background — just the can image with a subtle `scale(1.06)` hover instead of the lift/border-color animation used in grid3/grid2. The pin button and (for wishlist) image opacity/grayscale treatment are unchanged.

### Full available width on desktop — no longer capped at 5 fixed columns
Root cause: the outermost `<main style={{ maxWidth: 1100, ... }}>` wrapper in the App shell capped literally every page, including the grid, to 1100px — so "5 per row" always meant 5 *specific-sized* cards centered in 1100px, never more, regardless of screen width.
- `<main>`'s `maxWidth` is now conditional: `"none"` on `/` (Collection) and `/wishlist`, `1100` everywhere else (Stats, Can Wall) where a constrained reading width still makes sense for those layouts.
- Inside `CollectionPage`/`WishlistPage`, the controls (search bar, add-can/random/bulk buttons, tag filters, country filter, sort bar) are wrapped in their own `maxWidth: 1100` inner container so they don't stretch edge-to-edge and stay readable on big monitors — only the actual grid/tile rendering area is full-width.
- New `gridColumnsFor(viewMode)` helper replaces the old fixed `repeat(5,1fr)` / `repeat(3,1fr)` templates:
  - `grid5` → `repeat(auto-fill, minmax(110px, 1fr))` — naturally produces more than 5 columns on wide screens instead of 5 oversized cards.
  - `grid3` → `repeat(auto-fill, minmax(170px, 1fr))` — same idea, larger floor.
  - `grid2` → stays a fixed `repeat(2, 1fr)`, since that mode is meant to feel like a deliberate "zoomed in" 2-up view rather than an auto-filling grid.
- Tile-mode lists and the WishlistPage header banner are still individually wrapped at `maxWidth: 1100` so they don't stretch awkwardly even though the page shell itself is unconstrained.

### Full-quality can-wall photo uploads — direct browser-to-Blob client upload
Previous fix (compressing wall photos down to ~2.2MB to dodge Vercel's 413 limit) worked but sacrificed quality. Proper fix this session: upload directly from the browser to Vercel Blob storage using `@vercel/blob/client`'s `upload()`, which completely bypasses the serverless function's ~4.5MB request-body limit (already a dependency at `^0.23.0`, confirmed via `npm view` that it exposes a `./client` subpath export safe for Vite to bundle).
- **New file `api/client-upload-token.mjs`**: generates a short-lived client upload token via `handleUpload()` from `@vercel/blob/client`. Auth is checked inside `onBeforeGenerateToken` by parsing the shared password out of `clientPayload` (JSON-stringified `{auth: ...}`) — **not** a custom header, because `@vercel/blob/client`'s `upload()` does not have a documented way to attach arbitrary headers to its internal `handleUploadUrl` token-fetch request (confirmed via web search — `clientPayload` is the supported mechanism for passing custom data/auth through). `maximumSizeInBytes` set to 25MB as a generous ceiling; `allowedContentTypes` restricted to jpeg/png/webp.
- **`CanWallPage.handleCropped`** now calls `upload()` from `@vercel/blob/client` directly with `handleUploadUrl: "/api/client-upload-token"` and `clientPayload: JSON.stringify({ auth: atob(_PH) })`, getting back a real Blob URL with no serverless body-size involvement. Falls back to the old `compressWallPhoto()` + `/api/upload` route if the direct upload throws for any reason, and falls back further to base64-in-Supabase only if *that* also fails — same nested-fallback spirit as before, just with a much-better-quality happy path now.
- `CropModal` for wall photos: quality raised from `0.92`/`targetKB={2200}` back up to `quality={0.95}`/`targetKB={6000}`, since the upload path is no longer body-size-constrained. (`targetKB` only drives the live size-estimate indicator in the crop UI, not an actual compression loop — confirmed by re-reading `doCrop()`, which just does a single `canvas.toBlob` at the fixed `quality` prop.)
- **Deployment requirement**: `BLOB_READ_WRITE_TOKEN` must be set as an environment variable in Vercel for `api/client-upload-token.mjs` to work (same token Vercel auto-provisions when a Blob store is attached to the project — should already exist since the rest of the app's Blob usage depends on it too, but flagging here since this new endpoint reads it explicitly via `process.env.BLOB_READ_WRITE_TOKEN`).

### Can name font — Bebas Neue
Added `family=Bebas+Neue` to the Google Fonts `@import` (alongside Playfair Display/Satisfy/Oswald). Applied to the **prominent** can-name displays only (not dense admin/utility list rows, which stayed on Playfair Display to avoid Bebas Neue's all-caps wide-tracking look feeling oversized at 12px):
- `GridCard` name label (under the image in grid3/grid2 — hidden entirely in grid5)
- `TileCard` name (row-list view)
- `WishGridCard` / `WishTileCard` equivalents
- `CanDetailModal` / `WishDetailModal` title pill (the big red rounded pill) — was previously `'Satisfy',cursive` (script), now Bebas Neue with `fontWeight: 400` + `letterSpacing: 0.04em` to read as a bold condensed display face rather than a thin one.
- Left untouched: `BulkEditModal`'s item list rows (~line 1530) and the Stats page "anniversary" widget rows (~line 2983) — both dense 12px list rows where the existing Playfair Display reads better.


## Session: June 2026 — Can-name font swap (lowercase support) + tag section reorder

### Can name font — Bebas Neue → Fjalla One (supersedes prior session's note above)
Bebas Neue is an all-caps display face — it has no real lowercase glyphs, so any can name typed in lowercase rendered as small caps instead of true lowercase letters. Replaced with **Fjalla One**, a condensed bold sans-serif with proper lowercase letterforms, keeping the same poster-y display feel.
- Google Fonts `@import` line: `family=Bebas+Neue` → `family=Fjalla+One` (still alongside Playfair Display/Satisfy/Oswald).
- All 6 `fontFamily: "'Bebas Neue',sans-serif"` occurrences swapped to `"'Fjalla One',sans-serif"` via global replace — same call sites as documented above (`GridCard`/`TileCard`/`WishGridCard`/`WishTileCard` name labels, `CanDetailModal`/`WishDetailModal` title pill). `fontWeight: 400` and existing `letterSpacing` left as-is.

### Tag filter panel — Size tags now sort above Other tags
In both tag-filter panels (main Collection page filter bar and the Wishlist page filter bar — these are two separately-coded but structurally identical blocks in `App.jsx`), section render order was Brand → Other → Size. Reordered to **Brand → Size → Other** in both places. No logic changes — `sizeTagsAll`/`brandTagsAll`/`otherTagsAll` derivation (around `tagRoles[t] === "size"` checks) is unchanged, this was purely a JSX reordering of three existing conditional blocks per panel.

