import { useState, useEffect, useRef } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import * as db from "./db.js";

const _PH = "c29kYWNhbjEyMw==";
function checkPw(pw) { try { return atob(_PH) === pw; } catch { return false; } }

const SAMPLE_CANS = [
  { id: "1", name: "Coca-Cola Classic", image: null, tags: ["coca-cola", "330ml", "cola", "classic"], addedAt: Date.now() - 86400000 * 10 },
  { id: "2", name: "Fanta Orange", image: null, tags: ["fanta", "330ml", "orange", "citrus"], addedAt: Date.now() - 86400000 * 7 },
  { id: "3", name: "Sprite Zero", image: null, tags: ["sprite", "330ml", "zero-sugar", "lemon-lime"], addedAt: Date.now() - 86400000 * 5 },
  { id: "4", name: "Pepsi Max", image: null, tags: ["pepsi", "500ml", "cola", "zero-sugar"], addedAt: Date.now() - 86400000 * 3 },
  { id: "5", name: "Fanta Grape", image: null, tags: ["fanta", "330ml", "grape", "limited"], addedAt: Date.now() - 86400000 * 1 },
];

const SAMPLE_WISHLIST = [
  { id: "w1", name: "Coca-Cola Starlight", image: null, tags: ["coca-cola", "limited", "space-edition"], note: "Limited 2022 edition", addedAt: Date.now() - 86400000 * 2 },
  { id: "w2", name: "Fanta Mystery", image: null, tags: ["fanta", "mystery", "limited"], note: "Need to find this one!", addedAt: Date.now() - 86400000 },
];

const BRAND_COLORS = {
  "coca-cola": "#C8102E", fanta: "#FF6B00", sprite: "#00843D",
  pepsi: "#004B93", "7up": "#00A651", "mountain-dew": "#97D700",
  "dr-pepper": "#7B1818", "red-bull": "#C8A900", default: "#C8102E",
};

function getCanColor(tags = []) {
  for (const tag of tags) {
    const key = tag.toLowerCase().replace(/\s/g, "-");
    if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  }
  return BRAND_COLORS.default;
}

// Compresses image to under 2MB before upload using canvas
async function compressImage(file, maxSizeMB = 2, maxPx = 1920) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Scale down if too large
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      // Try quality 0.85 first, then lower if still too big
      const tryQuality = (q) => {
        canvas.toBlob(blob => {
          if (blob.size > maxSizeMB * 1024 * 1024 && q > 0.3) {
            tryQuality(Math.round((q - 0.1) * 10) / 10);
          } else {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          }
        }, "image/jpeg", q);
      };
      tryQuality(0.85);
    };
    img.onerror = () => resolve(file); // fallback: use original
    img.src = url;
  });
}

function CanSvg({ color, name }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
  const uid = color.replace("#", "");
  return (
    <svg viewBox="0 0 80 130" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", filter: "drop-shadow(0 6px 12px #00000033)" }}>
      <defs>
        <linearGradient id={`b${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00000044" /><stop offset="20%" stopColor={color + "dd"} />
          <stop offset="50%" stopColor={color} /><stop offset="80%" stopColor={color + "dd"} />
          <stop offset="100%" stopColor="#00000055" />
        </linearGradient>
        <linearGradient id={`mt${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#888" /><stop offset="40%" stopColor="#ddd" /><stop offset="60%" stopColor="#bbb" /><stop offset="100%" stopColor="#777" />
        </linearGradient>
        <linearGradient id={`mb${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#666" /><stop offset="50%" stopColor="#aaa" /><stop offset="100%" stopColor="#555" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="14" rx="20" ry="5.5" fill={`url(#mt${uid})`} />
      <rect x="20" y="14" width="40" height="4" fill={`url(#mt${uid})`} />
      <rect x="20" y="18" width="40" height="90" fill={`url(#b${uid})`} />
      <rect x="20" y="108" width="40" height="4" fill={`url(#mb${uid})`} />
      <ellipse cx="40" cy="112" rx="20" ry="5.5" fill={`url(#mb${uid})`} />
      <rect x="24" y="20" width="5" height="86" rx="2.5" fill="#ffffff22" />
      <rect x="20" y="38" width="40" height="2" fill="#ffffff18" />
      <rect x="20" y="88" width="40" height="2" fill="#ffffff18" />
      <text x="40" y="70" textAnchor="middle" fontFamily="Georgia,serif" fontSize="14" fontWeight="bold" fill="white" style={{ filter: "drop-shadow(0 1px 3px #0008)" }}>{initials}</text>
      <ellipse cx="40" cy="10" rx="6" ry="2.5" fill="#ccc" />
      <rect x="37" y="6" width="6" height="5" rx="1.5" fill="#bbb" />
    </svg>
  );
}

// ─── SHARED UI ───────────────────────────────────────────────────────────────

function ModalShell({ onClose, children, T }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000000bb", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bgCard, backgroundImage: T.stripe,
        border: `3px solid ${T.border}`, borderRadius: 20,
        padding: "36px 28px", width: "100%", maxWidth: 440,
        maxHeight: "90vh", overflowY: "auto", position: "relative",
        boxShadow: "0 24px 64px #00000077",
        animation: "popIn 0.28s cubic-bezier(.34,1.56,.64,1)",
      }}>
        {["tl", "tr", "bl", "br"].map(p => (
          <div key={p} style={{ position: "absolute", top: p[0] === "t" ? 12 : "auto", bottom: p[0] === "b" ? 12 : "auto", left: p[1] === "l" ? 14 : "auto", right: p[1] === "r" ? 14 : "auto", color: "#C8102E", fontSize: 12, opacity: 0.35 }}>★</div>
        ))}
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "#C8102E", border: "none", color: "#fff", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        {children}
      </div>
    </div>
  );
}

function TagPill({ tag, active, onClick, onRemove, T }) {
  return (
    <span onClick={onClick} style={{
      padding: "3px 10px", borderRadius: "999px", fontSize: 10,
      fontFamily: "'Oswald',sans-serif", letterSpacing: "0.06em",
      background: active ? "#C8102E" : (T ? T.bgCard : "#fff1e8"),
      color: active ? "#fff" : "#C8102E",
      border: `1.5px solid ${active ? "#C8102E" : "#C8102E44"}`,
      cursor: onClick || onRemove ? "pointer" : "default",
      display: "inline-flex", alignItems: "center", gap: 3,
      userSelect: "none", transition: "all 0.15s",
    }}>
      #{tag}
      {onRemove && <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ fontWeight: 900, opacity: 0.7 }}>×</span>}
    </span>
  );
}

function SortBar({ sort, setSort, viewMode, setViewMode, T }) {
  const sorts = [
    { v: "newest", l: "Newest" },
    { v: "oldest", l: "Oldest" },
    { v: "az", l: "A → Z" },
    { v: "za", l: "Z → A" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
      <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.2em" }}>SORT:</span>
      {sorts.map(s => (
        <button key={s.v} onClick={() => setSort(s.v)} style={{
          padding: "4px 12px", borderRadius: "999px",
          fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em",
          background: sort === s.v ? "#C8102E" : T.bgCard,
          color: sort === s.v ? "#fff" : T.textMuted,
          border: `1.5px solid ${sort === s.v ? "#C8102E" : T.border}`,
          cursor: "pointer", transition: "all 0.15s",
        }}>{s.l}</button>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        {[["grid", "⊞ GRID"], ["tile", "▤ TILE"]].map(([v, l]) => (
          <button key={v} onClick={() => setViewMode(v)} style={{
            padding: "4px 12px", borderRadius: "999px",
            fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em",
            background: viewMode === v ? "#C8102E" : T.bgCard,
            color: viewMode === v ? "#fff" : T.textMuted,
            border: `1.5px solid ${viewMode === v ? "#C8102E" : T.border}`,
            cursor: "pointer", transition: "all 0.15s",
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function sortCans(cans, sort) {
  return [...cans].sort((a, b) => {
    if (sort === "newest") return b.addedAt - a.addedAt;
    if (sort === "oldest") return a.addedAt - b.addedAt;
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "za") return b.name.localeCompare(a.name);
    return 0;
  });
}

// ─── ADD / EDIT MODAL ────────────────────────────────────────────────────────

function AddEditModal({ T, onSave, onClose, initial = {}, extraFields = [] }) {
  const [name, setName] = useState(initial.name || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(initial.tags || []);
  const [image, setImage] = useState(initial.image || null);
  const [note, setNote] = useState(initial.note || "");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const handleFile = async f => {
    if (!f || !f.type.startsWith("image/")) return;
    setUploading(true); setUploadErr("");
    try {
      const compressed = await compressImage(f);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "x-filename": `can-${Date.now()}.jpg`,
          "x-canvault-auth": atob(_PH),
        },
        body: compressed,
      });
      if (res.ok) {
        const { url } = await res.json();
        setImage(url);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(`${res.status}: ${err.error || "unknown"}`);
      }
    } catch (err) {
      const r = new FileReader(); r.onload = e => setImage(e.target.result); r.readAsDataURL(f);
      setUploadErr(`⚠️ Blob failed (${err.message}) — saved locally`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 28, color: "#C8102E", textAlign: "center", marginBottom: 4 }}>
        {initial.id ? "Edit" : "Add a Can"}
      </div>
      <div style={{ width: 46, height: 3, background: "#C8102E", margin: "0 auto 20px", borderRadius: 2 }} />

      {/* Image — mobile-friendly: invisible input covers entire area */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        style={{ border: `2px dashed ${drag ? "#C8102E" : T.border}`, borderRadius: 12, padding: 14, textAlign: "center", cursor: "pointer", marginBottom: 6, background: drag ? "#C8102E08" : T.bgInput, transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", overflow: "hidden", minHeight: 90 }}>
        <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", zIndex: 2 }} onChange={e => handleFile(e.target.files[0])} />
        {uploading
          ? <><span style={{ fontSize: 26, animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9 }}>UPLOADING…</p></>
          : image
            ? <img src={image} alt="preview" style={{ height: 80, borderRadius: 8, objectFit: "contain", position: "relative", zIndex: 1 }} />
            : <><span style={{ fontSize: 26 }}>📸</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9, letterSpacing: "0.1em" }}>TAP TO UPLOAD PHOTO</p></>}
      </div>
      {uploadErr && <p style={{ color: "#FF6B00", fontFamily: "'Oswald',sans-serif", fontSize: 9, marginBottom: 10, letterSpacing: "0.05em" }}>{uploadErr}</p>}

      <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>CAN NAME</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fanta Orange 330ml"
        style={{ width: "100%", padding: "10px 13px", marginBottom: 12, background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />

      {extraFields.includes("note") && <>
        <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>NOTE</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Where to find it, price, etc."
          style={{ width: "100%", padding: "10px 13px", marginBottom: 12, background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
      </>}

      <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>TAGS</label>
      <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
        <input value={tagInput} onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addTag())}
          placeholder="coca-cola, 330ml…"
          style={{ flex: 1, padding: "10px 13px", background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
        <button onClick={addTag} style={{ background: "#C8102E", border: "none", borderRadius: 9, padding: "0 16px", color: "#fff", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>+</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 18, minHeight: 26 }}>
        {tags.map(t => <TagPill key={t} tag={t} active T={T} onRemove={() => setTags(tags.filter(x => x !== t))} />)}
      </div>

      <button onClick={() => { if (name.trim()) onSave({ id: initial.id || Date.now().toString(), name: name.trim(), tags, image, note, addedAt: initial.addedAt || Date.now() }); }}
        disabled={!name.trim()}
        style={{ width: "100%", padding: "13px", background: name.trim() ? "#C8102E" : T.border, border: "none", borderRadius: 11, color: name.trim() ? "#fff" : T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.15em", cursor: name.trim() ? "pointer" : "not-allowed", boxShadow: name.trim() ? "0 4px 16px #C8102E44" : "none", transition: "all 0.2s" }}>
        {initial.id ? "SAVE CHANGES" : "ADD TO VAULT"}
      </button>
    </ModalShell>
  );
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────

function DetailModal({ T, can, isAdmin, onDelete, onEdit, onClose }) {
  const color = getCanColor(can.tags);
  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 85, height: 128, margin: "0 auto 14px", filter: `drop-shadow(0 10px 24px ${color}66)` }}>
          {can.image ? <img src={can.image} alt={can.name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }} /> : <CanSvg color={color} name={can.name} />}
        </div>
        <div style={{ display: "inline-block", background: "#C8102E", color: "#fff", fontFamily: "'Satisfy',cursive", fontSize: 24, padding: "4px 22px", borderRadius: "999px", marginBottom: 8, boxShadow: "0 4px 14px #C8102E55" }}>{can.name}</div>
        <p style={{ fontFamily: "'Oswald',sans-serif", color: T.textFaint, fontSize: 9, letterSpacing: "0.15em", marginBottom: 12 }}>
          ADDED {new Date(can.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
        </p>
        {can.note && <p style={{ fontFamily: "Georgia,serif", color: T.textMuted, fontSize: 12, fontStyle: "italic", marginBottom: 12, padding: "8px 16px", background: T.bgInput, borderRadius: 8, border: `1px solid ${T.border}` }}>"{can.note}"</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", marginBottom: 18 }}>
          {can.tags.map(t => <TagPill key={t} tag={t} T={T} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: T.border }} /><span style={{ color: "#C8102E" }}>★</span><div style={{ flex: 1, height: 1, background: T.border }} />
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={onEdit} style={{ background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, padding: "9px 20px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>EDIT</button>
            <button onClick={() => { onDelete(can.id); onClose(); }} style={{ background: "transparent", border: "2px solid #C8102E66", borderRadius: 9, padding: "9px 20px", color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>REMOVE</button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────

function LoginModal({ T, onLogin, onClose }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const go = () => { if (checkPw(pw)) onLogin(); else setErr("Incorrect password. Please try again."); };
  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 38, color: "#C8102E", marginBottom: 2 }}>Welcome!</div>
        <p style={{ fontFamily: "'Oswald',sans-serif", color: T.textMuted, letterSpacing: "0.15em", fontSize: 9, marginBottom: 6 }}>COLLECTOR ACCESS ONLY</p>
        <div style={{ width: 46, height: 3, background: "#C8102E", margin: "0 auto 20px", borderRadius: 2 }} />
        <input type="password" value={pw} autoFocus onChange={e => { setPw(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && go()} placeholder="Enter password…"
          style={{ width: "100%", padding: "12px 14px", marginBottom: 8, background: T.bgInput, border: `2px solid ${err ? "#C8102E" : T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 14, textAlign: "center" }} />
        {err && <p style={{ color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.05em", marginBottom: 8 }}>{err}</p>}
        <button onClick={go} style={{ width: "100%", padding: "12px", background: "#C8102E", border: "none", borderRadius: 9, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", boxShadow: "0 4px 16px #C8102E44" }}>SIGN IN</button>
        <p style={{ fontFamily: "Georgia,serif", color: T.textFaint, fontSize: 10, fontStyle: "italic", marginTop: 16 }}>Collectors only 🥤</p>
      </div>
    </ModalShell>
  );
}

// Deletes a file from Vercel Blob via the API route
async function deleteFromBlob(url) {
  if (!url || !url.includes("blob.vercel")) return;
  try {
    await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-canvault-auth": atob(_PH) },
      body: JSON.stringify({ url }),
    });
  } catch (e) { console.error("Blob delete failed", e); }
}

// ─── LOADING SPINNER ──────────────────────────────────────────────────────────

function LoadingSpinner({ T }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ fontSize: 40, animation: "spin 1s linear infinite", display: "inline-block", marginBottom: 12 }}>🥤</div>
      <p style={{ fontFamily: "'Oswald',sans-serif", color: T.textMuted, fontSize: 11, letterSpacing: "0.2em" }}>LOADING…</p>
    </div>
  );
}

// ─── COLLECTION PAGE ──────────────────────────────────────────────────────────

function CollectionPage({ T, isAdmin }) {
  const [cans, setCans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [sort, setSort] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!db.isConfigured()) { setCans(SAMPLE_CANS); setLoading(false); return; }
    db.getCans().then(rows => { setCans(rows.map(db.rowToCan)); setLoading(false); })
      .catch(() => { setCans(SAMPLE_CANS); setLoading(false); });
  }, []);

  const allTags = [...new Set(cans.flatMap(c => c.tags))].sort();
  const filtered = sortCans(cans.filter(can => {
    const s = search.toLowerCase();
    return (!s || can.name.toLowerCase().includes(s) || can.tags.some(t => t.includes(s))) &&
      (activeTags.length === 0 || activeTags.every(t => can.tags.includes(t)));
  }), sort);

  const saveCan = async can => {
    if (db.isConfigured()) {
      await db.upsertCan(can).catch(console.error);
      const rows = await db.getCans().catch(() => null);
      if (rows) setCans(rows.map(db.rowToCan));
    } else {
      setCans(p => p.find(c => c.id === can.id) ? p.map(c => c.id === can.id ? can : c) : [can, ...p]);
    }
    setModal(null);
  };

  const removeCan = async id => {
    const can = cans.find(c => c.id === id);
    if (db.isConfigured()) await db.deleteCan(id).catch(console.error);
    if (can?.image && can.image.includes("blob.vercel")) await deleteFromBlob(can.image);
    setCans(p => p.filter(c => c.id !== id));
  };

  return (
    <div>
      {!db.isConfigured() && (
        <div style={{ background: "#FF6B0022", border: "2px solid #FF6B00", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontFamily: "'Oswald',sans-serif", fontSize: 10, color: "#FF6B00", letterSpacing: "0.1em" }}>
          ⚠️ SUPABASE NOT CONFIGURED — showing sample data. See setup guide.
        </div>
      )}
      {loading ? <LoadingSpinner T={T} /> : <>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "#C8102E", borderRadius: "11px 0 0 11px", fontSize: 17 }}>🔍</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or tag…"
          style={{ width: "100%", padding: "13px 36px 13px 52px", background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 11, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 18 }}>×</button>}
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 14, padding: "12px 16px", background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 11 }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 7 }}>FILTER BY TAG</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {allTags.map(tag => <TagPill key={tag} tag={tag} active={activeTags.includes(tag)} onClick={() => setActiveTags(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])} T={T} />)}
            {activeTags.length > 0 && <span onClick={() => setActiveTags([])} style={{ padding: "3px 10px", color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>clear</span>}
          </div>
        </div>
      )}

      {/* Sort + view */}
      <SortBar sort={sort} setSort={setSort} viewMode={viewMode} setViewMode={setViewMode} T={T} />

      {/* Stats + Add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `2px dashed ${T.border}` }}>
        <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em" }}>
          {filtered.length === cans.length ? `${cans.length} CANS IN VAULT` : `SHOWING ${filtered.length} OF ${cans.length}`}
        </span>
        {isAdmin && (
          <button onClick={() => setModal("add")} style={{ background: "#C8102E", border: "none", borderRadius: "999px", padding: "7px 16px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>+ ADD CAN</button>
        )}
      </div>

      {/* Grid / Tile */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🫙</div>
          <p style={{ fontFamily: "'Playfair Display',serif", color: T.textMuted, fontSize: 18, fontStyle: "italic" }}>No cans found</p>
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 16 }}>
          {filtered.map((can, i) => <GridCard key={can.id} can={can} i={i} T={T} onClick={() => setModal({ can })} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((can, i) => <TileCard key={can.id} can={can} i={i} T={T} onClick={() => setModal({ can })} />)}
        </div>
      )}

      {/* Modals */}
      {modal === "add" && <AddEditModal T={T} onSave={saveCan} onClose={() => setModal(null)} />}
      {modal?.can && !modal.edit && (
        <DetailModal T={T} can={modal.can} isAdmin={isAdmin}
          onDelete={id => { removeCan(id); setModal(null); }}
          onEdit={() => setModal({ can: modal.can, edit: true })}
          onClose={() => setModal(null)} />
      )}
      {modal?.can && modal.edit && (
        <AddEditModal T={T} initial={modal.can} onSave={saveCan} onClose={() => setModal(null)} />
      )}
      </>}
    </div>
  );
}

function GridCard({ can, i, T, onClick }) {
  const color = getCanColor(can.tags);
  return (
    <div onClick={onClick} style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", animation: `popIn 0.3s cubic-bezier(.34,1.56,.64,1) ${i * 0.04}s both`, boxShadow: T.isDark ? "0 4px 20px #00000055" : "0 3px 12px #00000010,0 1px 0 #fff inset", transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1),box-shadow 0.22s,border-color 0.18s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px) rotate(-1deg)"; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 12px 30px ${color}33`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = T.isDark ? "0 4px 20px #00000055" : "0 3px 12px #00000010,0 1px 0 #fff inset"; }}>
      {/* Image area — dominant */}
      <div style={{ width: "100%", aspectRatio: "3/4", background: T.isDark ? "#1a0808" : "#FFF0DC", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${color}22 0%, transparent 70%)` }} />
        <div style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: color, opacity: 0.7 }} />
        <div style={{ width: "55%", height: "80%", position: "relative" }}>
          {can.image ? <img src={can.image} alt={can.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <CanSvg color={color} name={can.name} />}
        </div>
      </div>
      {/* Slim name bar only */}
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 11, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>{can.name}</div>
      </div>
    </div>
  );
}

function TileCard({ can, i, T, onClick }) {
  const color = getCanColor(can.tags);
  return (
    <div onClick={onClick} style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 11, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", animation: `popIn 0.25s ease ${i * 0.03}s both`, transition: "border-color 0.15s,box-shadow 0.15s", boxShadow: T.isDark ? "0 2px 12px #00000044" : "0 2px 8px #00000010" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 18px ${color}28`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = T.isDark ? "0 2px 12px #00000044" : "0 2px 8px #00000010"; }}>
      <div style={{ width: 36, height: 56, flexShrink: 0 }}>
        {can.image ? <img src={can.image} alt={can.name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 4 }} /> : <CanSvg color={color} name={can.name} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{can.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {can.tags.slice(0, 5).map(t => <TagPill key={t} tag={t} T={T} />)}
          {can.tags.length > 5 && <span style={{ fontSize: 9, color: T.textFaint, fontFamily: "'Oswald',sans-serif" }}>+{can.tags.length - 5}</span>}
        </div>
      </div>
      <div style={{ color: T.textFaint, fontSize: 10, fontFamily: "'Oswald',sans-serif", letterSpacing: "0.1em", flexShrink: 0 }}>
        {new Date(can.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </div>
      <div style={{ color: T.border, fontSize: 16 }}>›</div>
    </div>
  );
}

// ─── WISHLIST PAGE ────────────────────────────────────────────────────────────

function WishlistPage({ T, isAdmin }) {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [activeTags, setActiveTags] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!db.isConfigured()) { setWishes(SAMPLE_WISHLIST); setLoading(false); return; }
    db.getWishlist().then(rows => { setWishes(rows.map(db.rowToWish)); setLoading(false); })
      .catch(() => { setWishes(SAMPLE_WISHLIST); setLoading(false); });
  }, []);

  const allTags = [...new Set(wishes.flatMap(w => w.tags))].sort();
  const sorted = sortCans(wishes.filter(w =>
    activeTags.length === 0 || activeTags.every(t => w.tags.includes(t))
  ), sort);

  const saveWish = async w => {
    if (db.isConfigured()) {
      await db.upsertWish(w).catch(console.error);
      const rows = await db.getWishlist().catch(() => null);
      if (rows) setWishes(rows.map(db.rowToWish));
    } else {
      setWishes(p => p.find(x => x.id === w.id) ? p.map(x => x.id === w.id ? w : x) : [w, ...p]);
    }
    setModal(null);
  };

  const removeWish = async id => {
    const wish = wishes.find(w => w.id === id);
    if (db.isConfigured()) await db.deleteWish(id).catch(console.error);
    if (wish?.image && wish.image.includes("blob.vercel")) await deleteFromBlob(wish.image);
    setWishes(p => p.filter(w => w.id !== id));
  };

  return (
    <div>
      <div style={{ background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 36 }}>⭐</div>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.text, fontWeight: 700 }}>My Wishlist</div>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", marginTop: 2 }}>CANS I WANT TO FIND · {wishes.length} ITEMS</div>
        </div>
      </div>

      {loading ? <LoadingSpinner T={T} /> : <>
      <SortBar sort={sort} setSort={setSort} viewMode={viewMode} setViewMode={setViewMode} T={T} />

      {allTags.length > 0 && (
        <div style={{ marginBottom: 14, padding: "12px 16px", background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 11 }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 7 }}>FILTER BY TAG</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {allTags.map(tag => <TagPill key={tag} tag={tag} active={activeTags.includes(tag)} onClick={() => setActiveTags(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])} T={T} />)}
            {activeTags.length > 0 && <span onClick={() => setActiveTags([])} style={{ padding: "3px 10px", color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>clear</span>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `2px dashed ${T.border}` }}>
        <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em" }}>{wishes.length} ITEMS ON WISHLIST</span>
        {isAdmin && <button onClick={() => setModal("add")} style={{ background: "#C8102E", border: "none", borderRadius: "999px", padding: "7px 16px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>+ ADD WISH</button>}
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>⭐</div>
          <p style={{ fontFamily: "'Playfair Display',serif", color: T.textMuted, fontSize: 18, fontStyle: "italic" }}>No wishes yet</p>
          {isAdmin && <p style={{ fontFamily: "Georgia,serif", color: T.textFaint, fontSize: 12, marginTop: 6 }}>Add cans you're hunting for!</p>}
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 16 }}>
          {sorted.map((w, i) => <WishGridCard key={w.id} wish={w} i={i} T={T} onClick={() => setModal({ wish: w })} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((w, i) => <WishTileCard key={w.id} wish={w} i={i} T={T} onClick={() => setModal({ wish: w })} />)}
        </div>
      )}

      {modal === "add" && <AddEditModal T={T} extraFields={["note"]} onSave={saveWish} onClose={() => setModal(null)} />}
      {modal?.wish && !modal.edit && (
        <WishDetailModal T={T} wish={modal.wish} isAdmin={isAdmin}
          onDelete={id => { removeWish(id); setModal(null); }}
          onEdit={() => setModal({ wish: modal.wish, edit: true })}
          onClose={() => setModal(null)} />
      )}
      {modal?.wish && modal.edit && (
        <AddEditModal T={T} initial={modal.wish} extraFields={["note"]} onSave={saveWish} onClose={() => setModal(null)} />
      )}
      </>}
    </div>
  );
}

function WishGridCard({ wish, i, T, onClick }) {
  const color = getCanColor(wish.tags);
  return (
    <div onClick={onClick} style={{ background: T.bgCard, border: `2px dashed ${T.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", animation: `popIn 0.3s cubic-bezier(.34,1.56,.64,1) ${i * 0.04}s both`, transition: "transform 0.22s,box-shadow 0.22s,border-color 0.18s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.borderColor = "#C8102E"; e.currentTarget.style.boxShadow = "0 10px 26px #C8102E22"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = ""; }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "3/4", background: T.isDark ? "#1a0808" : "#FFF0DC", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${color}22 0%, transparent 70%)` }} />
        <div style={{ position: "absolute", top: 0, right: 10, background: "#C8102E", color: "#fff", fontSize: 8, fontFamily: "'Oswald',sans-serif", letterSpacing: "0.1em", padding: "2px 8px", borderRadius: "0 0 6px 6px" }}>WANT</div>
        <div style={{ width: "55%", height: "80%", opacity: 0.8, filter: "grayscale(20%)", position: "relative" }}>
          {wish.image ? <img src={wish.image} alt={wish.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <CanSvg color={color} name={wish.name} />}
        </div>
      </div>
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 11, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>{wish.name}</div>
      </div>
    </div>
  );
}

function WishTileCard({ wish, i, T, onClick }) {
  const color = getCanColor(wish.tags);
  return (
    <div onClick={onClick} style={{ background: T.bgCard, border: `2px dashed ${T.border}`, borderRadius: 11, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", animation: `popIn 0.25s ease ${i * 0.03}s both`, transition: "border-color 0.15s,box-shadow 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#C8102E"; e.currentTarget.style.boxShadow = "0 4px 18px #C8102E22"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = ""; }}>
      <div style={{ width: 36, height: 56, flexShrink: 0, opacity: 0.75, filter: "grayscale(30%)" }}>
        {wish.image ? <img src={wish.image} alt={wish.name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 4 }} /> : <CanSvg color={color} name={wish.name} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wish.name}</div>
        {wish.note && <div style={{ fontFamily: "Georgia,serif", fontSize: 10, color: T.textMuted, fontStyle: "italic", marginBottom: 4 }}>"{wish.note}"</div>}
        <div style={{ display: "flex", gap: 3 }}>{wish.tags.slice(0, 4).map(t => <TagPill key={t} tag={t} T={T} />)}</div>
      </div>
      <div style={{ background: "#C8102E", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 8, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 5, flexShrink: 0 }}>WANT</div>
    </div>
  );
}

function WishDetailModal({ T, wish, isAdmin, onDelete, onEdit, onClose }) {
  const color = getCanColor(wish.tags);
  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: "#C8102E", letterSpacing: "0.2em", marginBottom: 10 }}>★ ON MY WISHLIST ★</div>
        <div style={{ width: 80, height: 120, margin: "0 auto 14px", opacity: 0.8, filter: `grayscale(20%) drop-shadow(0 8px 20px ${color}55)` }}>
          {wish.image ? <img src={wish.image} alt={wish.name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }} /> : <CanSvg color={color} name={wish.name} />}
        </div>
        <div style={{ display: "inline-block", background: "#C8102E", color: "#fff", fontFamily: "'Satisfy',cursive", fontSize: 22, padding: "4px 20px", borderRadius: "999px", marginBottom: 8 }}>{wish.name}</div>
        {wish.note && <p style={{ fontFamily: "Georgia,serif", color: T.textMuted, fontSize: 12, fontStyle: "italic", margin: "10px 0", padding: "8px 14px", background: T.bgInput, borderRadius: 8, border: `1px solid ${T.border}` }}>"{wish.note}"</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", marginTop: 10, marginBottom: 16 }}>
          {wish.tags.map(t => <TagPill key={t} tag={t} T={T} />)}
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={onEdit} style={{ background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, padding: "9px 18px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>EDIT</button>
            <button onClick={() => { onDelete(wish.id); onClose(); }} style={{ background: "transparent", border: "2px solid #C8102E66", borderRadius: 9, padding: "9px 18px", color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>REMOVE</button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── CAN WALL PAGE ────────────────────────────────────────────────────────────

function CanWallPage({ T, isAdmin }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  const fileRef = useRef();
  const [drag, setDrag] = useState(false);
  const [newCaption, setNewCaption] = useState("");
  const [newImage, setNewImage] = useState(null);

  useEffect(() => {
    if (!db.isConfigured()) { setLoading(false); return; }
    db.getWallPhotos().then(rows => { setPhotos(rows.map(db.rowToPhoto)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const handleFile = async f => {
    if (!f) return;
    const isImage = f.type.startsWith("image/") || f.name.match(/\.(heic|heif)$/i);
    if (!isImage) return;
    setUploading(true); setUploadErr("");
    try {
      // HEIC/HEIF can't be drawn on canvas — send as-is and let Blob handle it
      const toUpload = f.type === "image/heic" || f.type === "image/heif" || f.type === ""
        ? f
        : await compressImage(f, 3, 2560);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": toUpload.type || "image/jpeg",
          "x-filename": `wall-${Date.now()}.jpg`,
          "x-canvault-auth": atob(_PH),
        },
        body: toUpload,
      });
      if (res.ok) {
        const { url } = await res.json();
        setNewImage(url);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(`${res.status}: ${err.error || "unknown"}`);
      }
    } catch (err) {
      const r = new FileReader(); r.onload = e => setNewImage(e.target.result); r.readAsDataURL(f);
      setUploadErr(`⚠️ Blob failed (${err.message}) — saved locally`);
    } finally { setUploading(false); }
  };

  const addPhoto = async () => {
    if (!newImage) return;
    const photo = { id: Date.now().toString(), image: newImage, caption: newCaption.trim(), addedAt: Date.now() };
    if (db.isConfigured()) {
      await db.addWallPhoto(photo).catch(console.error);
      // Optimistic update — don't refetch, just prepend
      setPhotos(p => [photo, ...p]);
    } else {
      setPhotos(p => [photo, ...p]);
    }
    setNewImage(null); setNewCaption(""); setAddModal(false);
  };

  const removePhoto = async id => {
    const photo = photos.find(p => p.id === id);
    if (db.isConfigured()) await db.deleteWallPhoto(id).catch(console.error);
    if (photo?.image && photo.image.includes("blob.vercel")) await deleteFromBlob(photo.image);
    setPhotos(p => p.filter(x => x.id !== id));
  };

  return (
    <div>
      <div style={{ background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 36 }}>📸</div>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.text, fontWeight: 700 }}>My Can Wall</div>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", marginTop: 2 }}>SHELF & WALL PHOTOS · {photos.length} PHOTOS</div>
        </div>
        {isAdmin && (
          <button onClick={() => setAddModal(true)} style={{ marginLeft: "auto", background: "#C8102E", border: "none", borderRadius: "999px", padding: "8px 18px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>+ ADD PHOTO</button>
        )}
      </div>

      {loading ? <LoadingSpinner T={T} /> : photos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", border: `2px dashed ${T.border}`, borderRadius: 14, background: T.stripe }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🗄️</div>
          <p style={{ fontFamily: "'Playfair Display',serif", color: T.textMuted, fontSize: 20, fontStyle: "italic", marginBottom: 6 }}>No wall photos yet</p>
          {isAdmin
            ? <p style={{ fontFamily: "Georgia,serif", color: T.textFaint, fontSize: 12 }}>Upload a photo of your collection shelves!</p>
            : <p style={{ fontFamily: "Georgia,serif", color: T.textFaint, fontSize: 12 }}>Sign in to add photos.</p>}
          {isAdmin && (
            <button onClick={() => setAddModal(true)} style={{ marginTop: 18, background: "#C8102E", border: "none", borderRadius: "999px", padding: "10px 24px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", boxShadow: "0 4px 16px #C8102E44" }}>UPLOAD FIRST PHOTO</button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {photos.map((photo, i) => (
            <div key={photo.id} onClick={() => setViewPhoto(photo)} style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${T.border}`, cursor: "pointer", animation: `popIn 0.3s ease ${i * 0.06}s both`, transition: "transform 0.2s,box-shadow 0.2s,border-color 0.15s", background: T.bgCard, boxShadow: T.isDark ? "0 4px 20px #00000055" : "0 3px 12px #00000010" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.borderColor = "#C8102E"; e.currentTarget.style.boxShadow = "0 8px 28px #C8102E22"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = T.isDark ? "0 4px 20px #00000055" : "0 3px 12px #00000010"; }}>
              <div style={{ width: "100%", height: 200, overflow: "hidden" }}>
                <img src={photo.image} alt={photo.caption || "Can wall"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              {(photo.caption || true) && (
                <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>

                    {photo.caption && <div style={{ fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 13, color: T.text, marginBottom: 2 }}>{photo.caption}</div>}
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textFaint, letterSpacing: "0.1em" }}>{new Date(photo.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</div>
                  </div>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); removePhoto(photo.id); }} style={{ background: "none", border: "none", color: "#C8102E66", fontSize: 18, cursor: "pointer", padding: 4 }}>🗑</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add photo modal */}
      {addModal && (
        <ModalShell onClose={() => { setAddModal(false); setNewImage(null); setNewCaption(""); }} T={T}>
          <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 28, color: "#C8102E", textAlign: "center", marginBottom: 4 }}>Add Wall Photo</div>
          <div style={{ width: 46, height: 3, background: "#C8102E", margin: "0 auto 18px", borderRadius: 2 }} />
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ border: `2px dashed ${drag ? "#C8102E" : T.border}`, borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer", marginBottom: 14, background: drag ? "#C8102E08" : T.bgInput, transition: "all 0.2s", minHeight: 140, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, position: "relative", overflow: "hidden" }}>
            {/* Invisible full-area file input — works on iOS/Android */}
            <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", zIndex: 2 }} onChange={e => handleFile(e.target.files[0])} />
            {uploading
              ? <><span style={{ fontSize: 36, animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9 }}>UPLOADING…</p></>
              : newImage
                ? <img src={newImage} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 8, objectFit: "contain", position: "relative", zIndex: 1 }} />
                : <><span style={{ fontSize: 40 }}>🖼️</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9, letterSpacing: "0.12em" }}>TAP TO UPLOAD PHOTO</p><p style={{ color: T.textFaint, fontFamily: "Georgia,serif", fontSize: 11, fontStyle: "italic" }}>Your shelf, your wall, your display</p></>}
          </div>
          {uploadErr && <p style={{ color: "#FF6B00", fontFamily: "'Oswald',sans-serif", fontSize: 9, marginBottom: 8 }}>{uploadErr}</p>}
          <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 5 }}>CAPTION (optional)</label>
          <input value={newCaption} onChange={e => setNewCaption(e.target.value)} placeholder="e.g. My bedroom shelf, Jan 2025"
            style={{ width: "100%", padding: "10px 13px", marginBottom: 16, background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
          <button onClick={addPhoto} disabled={!newImage}
            style={{ width: "100%", padding: "13px", background: newImage ? "#C8102E" : T.border, border: "none", borderRadius: 11, color: newImage ? "#fff" : T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.15em", cursor: newImage ? "pointer" : "not-allowed", boxShadow: newImage ? "0 4px 16px #C8102E44" : "none", transition: "all 0.2s" }}>
            ADD TO WALL
          </button>
        </ModalShell>
      )}

      {/* Lightbox */}
      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000000ee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={viewPhoto.image} alt={viewPhoto.caption || ""} style={{ maxWidth: "95vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 12, boxShadow: "0 0 80px #00000099" }} />
          {viewPhoto.caption && <p style={{ fontFamily: "'Satisfy',cursive", color: "#FFE8D0", fontSize: 22, marginTop: 16, textShadow: "0 2px 8px #000" }}>{viewPhoto.caption}</p>}
          <p style={{ fontFamily: "'Oswald',sans-serif", color: "#ffffff55", fontSize: 10, letterSpacing: "0.2em", marginTop: 8 }}>CLICK ANYWHERE TO CLOSE</p>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const T = {
    isDark: dark,
    bg: dark ? "#1a0808" : "#FFF5E6",
    bgCard: dark ? "#240e0e" : "#FFFBF5",
    bgInput: dark ? "#2e1212" : "#fff",
    border: dark ? "#5a2020" : "#E8C4A0",
    text: dark ? "#F5E6D0" : "#2A0A0A",
    textMuted: dark ? "#9a7060" : "#8B4040",
    textFaint: dark ? "#5a3030" : "#C8A080",
    stripe: dark
      ? "repeating-linear-gradient(180deg,#1a0808 0px,#1a0808 24px,#220c0c 24px,#220c0c 48px)"
      : "repeating-linear-gradient(180deg,#FFF5E6 0px,#FFF5E6 24px,#FFF0DC 24px,#FFF0DC 48px)",
  };

  const NAV = [
    { id: "collection", path: "/", label: "Collection", icon: "🥤", title: "The Collection" },
    { id: "wishlist", path: "/wishlist", label: "Wishlist", icon: "⭐", title: "Wishlist" },
    { id: "wall", path: "/canwall", label: "Can Wall", icon: "📸", title: "Can Wall" },
  ];

  const currentNav = NAV.find(n => n.path === location.pathname) || NAV[0];

  const goTo = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "Georgia,'Times New Roman',serif", transition: "background 0.3s,color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Satisfy&family=Oswald:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:7px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:#C8102E;border-radius:4px}
        input::placeholder{color:${T.textFaint};font-family:Georgia,serif}
        input:focus{outline:none;border-color:#C8102E!important;box-shadow:0 0 0 3px #C8102E1a}
        @keyframes popIn{from{opacity:0;transform:scale(0.84) translateY(14px)}to{opacity:1;transform:none}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-18px)}to{opacity:1;transform:none}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
        .hdr{animation:slideDown 0.4s ease}
        button:active{opacity:0.85}
        .mob-menu{animation:slideIn 0.2s ease}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* HEADER */}
      <header className="hdr" style={{ background: "#C8102E", backgroundImage: "repeating-linear-gradient(90deg,transparent 0,transparent 28px,#00000012 28px,#00000012 29px)", borderBottom: "5px solid #8a0000", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 24px #00000055" }}>
        <div style={{ background: "#8a0000", padding: "3px 12px", display: "flex", justifyContent: "center", gap: 16, overflow: "hidden" }}>
          {["★ EST. 2020 ★", "★ EVERY CAN COUNTS ★"].map(t => (
            <span key={t} style={{ color: "#FFE8D0", fontFamily: "'Oswald',sans-serif", fontSize: 9, letterSpacing: "0.2em", whiteSpace: "nowrap" }}>{t}</span>
          ))}
        </div>

        {/* Single row: logo left, dark toggle + hamburger right. Nothing else. */}
        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 38, height: 38, background: "#FFF5E6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #FFE8D0", fontSize: 20 }}>🥤</div>
            <div>
              <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 26, color: "#FFF5E6", lineHeight: 1, textShadow: "2px 2px 0 #7a0000" }}>CanVault</div>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 7, color: "#FFD0C0", letterSpacing: "0.2em" }}>SODA CAN COLLECTION</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setDark(d => !d)} style={{ background: dark ? "#FFF5E6" : "#8a0000", border: `2px solid ${dark ? "#FFE8D0" : "#5a0000"}`, borderRadius: "999px", padding: "7px 11px", color: dark ? "#C8102E" : "#FFF5E6", fontSize: 15, cursor: "pointer", lineHeight: 1 }}>
              {dark ? "☀️" : "🌙"}
            </button>
            <button onClick={() => setMenuOpen(m => !m)} style={{ background: menuOpen ? "#FFF5E6" : "#8a0000", border: `2px solid ${menuOpen ? "#FFE8D0" : "#5a0000"}`, borderRadius: 10, padding: "7px 12px", color: menuOpen ? "#C8102E" : "#FFF5E6", cursor: "pointer", fontSize: 18, lineHeight: 1, fontWeight: 700 }}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Dropdown menu — all navigation lives here */}
        {menuOpen && (
          <div className="mob-menu" style={{ background: "#a00020", borderTop: "2px solid #7a0000", padding: "10px 14px 16px" }}>
            {NAV.map(n => (
              <button key={n.path} onClick={() => goTo(n.path)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "13px 16px", marginBottom: 6, background: currentNav.path === n.path ? "#FFF5E6" : "transparent", border: `2px solid ${currentNav.path === n.path ? "#FFF5E6" : "#FFD0C033"}`, borderRadius: 11, color: currentNav.path === n.path ? "#C8102E" : "#FFE8D0", fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>
                <span style={{ fontSize: 22 }}>{n.icon}</span>
                <span>{n.label}</span>
                {currentNav.path === n.path && <span style={{ marginLeft: "auto" }}>●</span>}
              </button>
            ))}
            <div style={{ borderTop: "1px solid #FFD0C022", marginTop: 8, paddingTop: 12 }}>
              {isAdmin
                ? <button onClick={() => { setIsAdmin(false); setMenuOpen(false); }} style={{ width: "100%", padding: "12px", background: "transparent", border: "2px solid #FFD0C055", borderRadius: 11, color: "#FFD0C0", fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}>SIGN OUT</button>
                : <button onClick={() => { setShowLogin(true); setMenuOpen(false); }} style={{ width: "100%", padding: "12px", background: "#FFF5E6", border: "2px solid #FFE8D0", borderRadius: 11, color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}>🔐 SIGN IN</button>
              }
            </div>
          </div>
        )}
      </header>

      {/* HERO BAND — subpage header */}
      <div style={{ background: T.stripe, borderBottom: `3px solid ${T.border}`, padding: "14px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textFaint, letterSpacing: "0.15em", cursor: "pointer" }} onClick={() => goTo("/")}>CANVAULT</span>
          {location.pathname !== "/" && <>
            <span style={{ color: T.textFaint, fontSize: 12 }}>›</span>
            <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em" }}>{currentNav?.label.toUpperCase()}</span>
          </>}
        </div>
        <div style={{ maxWidth: 1100, margin: "4px auto 0" }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(22px,4vw,38px)", color: "#C8102E", fontWeight: 900, fontStyle: "italic", textShadow: dark ? "none" : "2px 2px 0 #FFD0C0", lineHeight: 1.1 }}>
            {currentNav?.icon} {currentNav?.title}
          </h1>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 14px" }}>
        <Routes>
          <Route path="/" element={<CollectionPage T={T} isAdmin={isAdmin} />} />
          <Route path="/wishlist" element={<WishlistPage T={T} isAdmin={isAdmin} />} />
          <Route path="/canwall" element={<CanWallPage T={T} isAdmin={isAdmin} />} />
          <Route path="*" element={<CollectionPage T={T} isAdmin={isAdmin} />} />
        </Routes>
      </main>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 20px", borderTop: `2px dashed ${T.border}`, marginTop: 20 }}>
        <p style={{ fontFamily: "'Satisfy',cursive", fontSize: 22, color: "#C8102E" }}>CanVault</p>
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textFaint, letterSpacing: "0.2em", marginTop: 4 }}>★ EVERY CAN TELLS A STORY ★</p>
        <a href="mailto:tondatonc@gmail.com" style={{ fontFamily: "Georgia,serif", fontSize: 11, color: T.textMuted, marginTop: 10, display: "inline-block", textDecoration: "none", fontStyle: "italic" }}>tondatonc@gmail.com</a>
      </div>

      {showLogin && <LoginModal T={T} onLogin={() => { setIsAdmin(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
    </div>
  );
}
