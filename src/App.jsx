import { useState, useEffect, useRef } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import * as db from "./db.js";
import { resolveCountry, flagUrl, COUNTRY_LIST, ALL_COUNTRIES } from "./countries.js";

// ─── COUNTRY CODE LOOKUP ──────────────────────────────────────────────────────


const _PH = "c29kYWNhbjEyMw==";
function checkPw(pw) { try { return atob(_PH) === pw; } catch { return false; } }

function FlagImg({ iso2, name }) {
  if (!iso2) return null;
  return <img src={flagUrl(iso2)} alt={name} title={name} style={{ width: 20, height: 15, borderRadius: 2, verticalAlign: "middle", marginRight: 5, flexShrink: 0, boxShadow: "0 1px 3px #00000033" }} />;
}

function CountryInput({ value, onChange, T, placeholder = "cze, ger, fra…" }) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused] = useState(false);
  const ref = useRef();

  const getSuggestions = (q) => {
    if (!q.trim()) return setSuggestions([]);
    const low = q.toLowerCase();
    setSuggestions(
      COUNTRY_LIST.filter(c =>
        c.name.toLowerCase().startsWith(low) ||
        Object.keys(ALL_COUNTRIES).some(k => k.startsWith(low.slice(0,3)) && ALL_COUNTRIES[k][1] === c.name)
      ).slice(0, 6)
    );
  };

  const add = (nameOrRaw) => {
    const rc = resolveCountry(nameOrRaw);
    const name = rc?.name || nameOrRaw.trim();
    if (name && !value.includes(name)) onChange([...value, name]);
    setInput(""); setSuggestions([]);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 7, marginBottom: 6 }}>
        <input ref={ref} value={input}
          onChange={e => { setInput(e.target.value); getSuggestions(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (input.trim()) add(input); } if (e.key === "Escape") setSuggestions([]); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          placeholder={placeholder}
          style={{ flex: 1, padding: "10px 13px", background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }}
        />
        <button onClick={() => { if (input.trim()) add(input); }} style={{ background: "#C8102E", border: "none", borderRadius: 9, padding: "0 16px", color: "#fff", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>+</button>
      </div>
      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 46, background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 10, zIndex: 50, overflow: "hidden", boxShadow: "0 8px 24px #00000044" }}>
          {suggestions.map(c => (
            <div key={c.name} onMouseDown={() => add(c.name)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, transition: "background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#C8102E22"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <FlagImg iso2={c.iso2} name={c.name} />
              <span style={{ fontFamily: "Georgia,serif", fontSize: 13, color: T.text }}>{c.name}</span>
            </div>
          ))}
        </div>
      )}
      {/* Selected countries */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, minHeight: 24 }}>
        {value.map(c => {
          const rc = resolveCountry(c);
          return (
            <span key={c} style={{ padding: "3px 10px", borderRadius: "999px", fontSize: 11, fontFamily: "Georgia,serif", background: T.bgCard, color: T.text, border: `1.5px solid ${T.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {rc?.iso2 && <FlagImg iso2={rc.iso2} name={rc.name} />}
              {rc?.name || c}
              <span onClick={() => onChange(value.filter(x => x !== c))} style={{ cursor: "pointer", opacity: 0.6, fontWeight: 900, fontSize: 13 }}>×</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}


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

// Custom tag colors — merged with BRAND_COLORS, stored in localStorage
function loadCustomColors() {
  try { return JSON.parse(localStorage.getItem("cv_tag_colors") || "{}"); } catch { return {}; }
}
function saveCustomColors(colors) {
  localStorage.setItem("cv_tag_colors", JSON.stringify(colors));
}

function getCanColor(tags = [], customColors = {}) {
  for (const tag of tags) {
    const key = tag.toLowerCase().replace(/\s/g, "-");
    if (customColors[key]) return customColors[key];
    if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  }
  return BRAND_COLORS.default;
}

// Compress can photos to ~150KB (small grid thumbnails)
async function compressCanPhoto(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Scale to max 900px — enough for grid display
      let { width, height } = img;
      const maxPx = 900;
      if (width > maxPx || height > maxPx) {
        const r = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx2d = canvas.getContext("2d");
      ctx2d.fillStyle = "#ffffff";
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.drawImage(img, 0, 0, width, height);
      const target = 150 * 1024; // 150 KB
      const tryQ = (q) => {
        canvas.toBlob(blob => {
          if (blob.size > target && q > 0.2) tryQ(Math.round((q - 0.05) * 100) / 100);
          else resolve(new File([blob], "can.jpg", { type: "image/jpeg" }));
        }, "image/jpeg", q);
      };
      tryQ(0.82);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// Compress wall photos to just under 4MB Vercel limit, max quality
async function compressWallPhoto(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maxPx = 3840; // 4K max
      if (width > maxPx || height > maxPx) {
        const r = Math.min(maxPx / width, maxPx / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const target = 3.8 * 1024 * 1024; // 3.8 MB — just under 4MB limit
      const tryQ = (q) => {
        canvas.toBlob(blob => {
          if (blob.size > target && q > 0.4) tryQ(Math.round((q - 0.05) * 100) / 100);
          else resolve(new File([blob], "wall.jpg", { type: "image/jpeg" }));
        }, "image/jpeg", q);
      };
      tryQ(0.96); // start very high quality
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// ─── CROP MODAL ──────────────────────────────────────────────────────────────

function CropModal({ src, onCrop, onCancel, T, quality = 0.97, targetKB = null }) {
  const imgRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [sizeInfo, setSizeInfo] = useState({ px: "", kb: "…" });
  const [estimating, setEstimating] = useState(false);
  const [activeHandle, setActiveHandle] = useState(null); // which handle is being dragged
  const magCanvasRef = useRef();
  const startRef = useRef();
  const estimateTimer = useRef();

  // Draw magnifier showing the corner being dragged
  useEffect(() => {
    if (!activeHandle || activeHandle === "drag" || !magCanvasRef.current || !imgRef.current) return;
    const img = imgRef.current;
    const canvas = magCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const MAG = 1; // no zoom — just shows what's under finger
    const SIZE = 100; // canvas size in px

    // Which corner/edge of the crop box to magnify
    const cx = activeHandle.includes("e") ? (box.x + box.w) : box.x;
    const cy = activeHandle.includes("s") ? (box.y + box.h) : box.y;

    // Source pixel coords on original image
    const sx = cx * img.naturalWidth;
    const sy = cy * img.naturalHeight;
    const srcSize = SIZE / MAG;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    // Circle clip
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sx - srcSize / 2, sy - srcSize / 2, srcSize, srcSize, 0, 0, SIZE, SIZE);
    ctx.restore();

    // Crosshair
    ctx.strokeStyle = "#C8102E";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2, SIZE / 2 - 8); ctx.lineTo(SIZE / 2, SIZE / 2 + 8);
    ctx.moveTo(SIZE / 2 - 8, SIZE / 2); ctx.lineTo(SIZE / 2 + 8, SIZE / 2);
    ctx.stroke();

    // Border
    ctx.strokeStyle = "#C8102E";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [activeHandle, box]);

  const getXY = (e, rect) => {
    const s = e.touches ? e.touches[0] : e;
    return { x: (s.clientX - rect.left) / rect.width, y: (s.clientY - rect.top) / rect.height };
  };

  const onDown = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    const rect = e.currentTarget.closest(".crop-area").getBoundingClientRect();
    startRef.current = { pt: getXY(e, rect), box: { ...box }, mode };
    if (mode === "drag") setDragging(true);
    setActiveHandle(mode);
  };

  const onUp = () => { setDragging(false); startRef.current = null; setActiveHandle(null); };

  // Live size estimation — debounced so it doesn't lag while dragging
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const pw = Math.round(img.naturalWidth * box.w);
    const ph = Math.round(img.naturalHeight * box.h);
    setSizeInfo(s => ({ ...s, px: `${pw} × ${ph} px` }));
    setEstimating(true);
    clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(() => {
      const canvas = document.createElement("canvas");
      canvas.width = pw; canvas.height = ph;
      canvas.getContext("2d").drawImage(img,
        Math.round(img.naturalWidth * box.x), Math.round(img.naturalHeight * box.y),
        pw, ph, 0, 0, pw, ph);
      canvas.toBlob(blob => {
        setSizeInfo({ px: `${pw} × ${ph} px`, kb: `${(blob.size / 1024).toFixed(0)} KB` });
        setEstimating(false);
      }, "image/jpeg", quality);
    }, 300);
    return () => clearTimeout(estimateTimer.current);
  }, [box, quality]);

  const doCrop = () => {
    const img = imgRef.current;
    const cw = Math.round(img.naturalWidth * box.w);
    const ch = Math.round(img.naturalHeight * box.h);
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img,
      Math.round(img.naturalWidth * box.x), Math.round(img.naturalHeight * box.y),
      cw, ch, 0, 0, cw, ch);
    canvas.toBlob(blob => onCrop(new File([blob], "cropped.jpg", { type: "image/jpeg" })), "image/jpeg", quality);
  };

  // Handles: large invisible hitbox (44px) with small visible icon inside
  // Corner = square icon, edge = rectangle icon
  const handles = [
    { id: "nw", icon: "corner", style: { top: -22, left: -22, cursor: "nw-resize" } },
    { id: "ne", icon: "corner", style: { top: -22, right: -22, cursor: "ne-resize" } },
    { id: "sw", icon: "corner", style: { bottom: -22, left: -22, cursor: "sw-resize" } },
    { id: "se", icon: "corner", style: { bottom: -22, right: -22, cursor: "se-resize" } },
    { id: "n",  icon: "h-edge", style: { top: -22, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
    { id: "s",  icon: "h-edge", style: { bottom: -22, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
    { id: "w",  icon: "v-edge", style: { left: -22, top: "50%", transform: "translateY(-50%)", cursor: "w-resize" } },
    { id: "e",  icon: "v-edge", style: { right: -22, top: "50%", transform: "translateY(-50%)", cursor: "e-resize" } },
  ];

  const RATIOS = [
    { label: "Free",            w: null,  h: null },
    { label: "330ml",           w: 66,    h: 122  },  // standard 330ml (Coke, Fanta, Sprite...)
    { label: "330ml Sleek",     w: 57,    h: 156  },  // slim/sleek 330ml
    { label: "250ml",           w: 53,    h: 135  },  // Red Bull, slim 250ml
    { label: "500ml",           w: 66,    h: 168  },  // standard 500ml (Monster, large cans)
    { label: "500ml Sleek",     w: 57,    h: 190  },  // slim 500ml
    { label: "1:1 Square",      w: 1,     h: 1    },  // square
  ];
  const [ratio, setRatio] = useState(null);

  const applyRatio = (r) => {
    setRatio(r);
    if (!r.w) return;
    const img = imgRef.current;
    if (!img) return;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = r.w / r.h;
    let w, h;
    if (targetAspect > imgAspect) { w = 0.9; h = (w * img.naturalWidth / targetAspect) / img.naturalHeight; }
    else { h = 0.9; w = (h * img.naturalHeight * targetAspect) / img.naturalWidth; }
    const x = (1 - w) / 2, y = (1 - h) / 2;
    setBox({ x, y, w, h });
  };

  // Lock ratio while resizing — expands from center when ratio is locked
  const onMoveWithRatio = (e) => {
    if (!startRef.current) return;
    e.preventDefault();
    const rect = document.querySelector(".crop-area").getBoundingClientRect();
    const pt = getXY(e, rect);
    const dx = pt.x - startRef.current.pt.x;
    const dy = pt.y - startRef.current.pt.y;
    const ob = startRef.current.box;
    const { mode } = startRef.current;
    let nb = { ...ob };

    if (mode === "drag") {
      nb.x = Math.max(0, Math.min(1 - ob.w, ob.x + dx));
      nb.y = Math.max(0, Math.min(1 - ob.h, ob.y + dy));
    } else if (ratio?.w) {
      // Ratio locked: pick dominant drag axis, resize from center
      const img = imgRef.current;
      const scaledAspect = (ratio.w / ratio.h) / (img.naturalWidth / img.naturalHeight);
      const cx = ob.x + ob.w / 2;
      const cy = ob.y + ob.h / 2;
      // Use whichever axis the handle belongs to
      const usesH = mode.includes("e") || mode.includes("w");
      let newHalfW, newHalfH;
      if (usesH) {
        const sign = mode.includes("e") ? 1 : -1;
        newHalfW = Math.max(0.05, ob.w / 2 + sign * dx);
        newHalfH = newHalfW / scaledAspect;
      } else {
        const sign = mode.includes("s") ? 1 : -1;
        newHalfH = Math.max(0.05, ob.h / 2 + sign * dy);
        newHalfW = newHalfH * scaledAspect;
      }
      // For corner handles use diagonal average
      if (mode.length === 2) {
        const signX = mode.includes("e") ? 1 : -1;
        const signY = mode.includes("s") ? 1 : -1;
        newHalfW = Math.max(0.05, ob.w / 2 + signX * dx);
        newHalfH = newHalfW / scaledAspect;
        // Fallback to Y if X gives nothing
        if (Math.abs(dx) < Math.abs(dy)) {
          newHalfH = Math.max(0.05, ob.h / 2 + signY * dy);
          newHalfW = newHalfH * scaledAspect;
        }
      }
      nb.w = Math.min(newHalfW * 2, 1);
      nb.h = Math.min(newHalfH * 2, 1);
      nb.x = Math.max(0, Math.min(1 - nb.w, cx - nb.w / 2));
      nb.y = Math.max(0, Math.min(1 - nb.h, cy - nb.h / 2));
    } else {
      if (mode.includes("e")) nb.w = Math.max(0.05, Math.min(1 - ob.x, ob.w + dx));
      if (mode.includes("s")) nb.h = Math.max(0.05, Math.min(1 - ob.y, ob.h + dy));
      if (mode.includes("w")) { nb.x = Math.max(0, ob.x + dx); nb.w = Math.max(0.05, ob.w - dx); }
      if (mode.includes("n")) { nb.y = Math.max(0, ob.y + dy); nb.h = Math.max(0.05, ob.h - dy); }
    }
    setBox(nb);
  };

  const kbNum = parseInt(sizeInfo.kb);
  const sizeColor = targetKB
    ? kbNum > targetKB ? "#FF4444" : kbNum > targetKB * 0.8 ? "#FF9900" : "#22C55E"
    : "#22C55E";

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000000ee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bgCard, border: `3px solid ${T.border}`, borderRadius: 16, padding: 14, width: "100%", maxWidth: "min(900px, 96vw)", maxHeight: "95vh", display: "flex", flexDirection: "column", gap: 10, animation: "popIn 0.2s ease" }}>

        {/* Header with live size */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em" }}>DRAG · RESIZE · CROP</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textFaint, letterSpacing: "0.1em" }}>{sizeInfo.px}</span>
            <div style={{ background: estimating ? T.border : sizeColor + "22", border: `1.5px solid ${estimating ? T.border : sizeColor}`, borderRadius: 6, padding: "3px 10px", minWidth: 70, textAlign: "center", transition: "all 0.3s" }}>
              <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 12, fontWeight: 700, color: estimating ? T.textFaint : sizeColor, letterSpacing: "0.1em" }}>
                {estimating ? "…" : sizeInfo.kb}
              </span>
            </div>
            {targetKB && !estimating && kbNum > targetKB && (
              <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: "#FF4444", letterSpacing: "0.05em" }}>OVER LIMIT</span>
            )}
          </div>
        </div>

        {/* Ratio buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {RATIOS.map(r => (
            <button key={r.label} onClick={() => applyRatio(r)} style={{
              padding: "5px 10px", borderRadius: 6, fontFamily: "'Oswald',sans-serif", fontSize: 10,
              fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", border: "1.5px solid",
              background: ratio?.label === r.label ? "#C8102E" : T.bgInput,
              borderColor: ratio?.label === r.label ? "#C8102E" : T.border,
              color: ratio?.label === r.label ? "#fff" : T.textMuted,
              transition: "all 0.15s",
            }}>{r.label}</button>
          ))}
        </div>

        {/* Crop area */}
        <div className="crop-area" style={{ position: "relative", width: "100%", touchAction: "none", userSelect: "none", borderRadius: 8, overflow: "hidden", maxHeight: "55vh" }}
          onMouseMove={onMoveWithRatio} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchMove={onMoveWithRatio} onTouchEnd={onUp}>
          <img ref={imgRef} src={src} alt="crop" style={{ width: "100%", height: "100%", maxHeight: "55vh", objectFit: "contain", display: "block", background: "transparent" }}
            onLoad={() => {
              const img = imgRef.current;
              if (!img) return;
              // Try to auto-detect content bounds for transparent PNGs
              try {
                const offscreen = document.createElement('canvas');
                offscreen.width = img.naturalWidth;
                offscreen.height = img.naturalHeight;
                const ctx = offscreen.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const { data: px, width: W, height: H } = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
                let minX = W, minY = H, maxX = 0, maxY = 0, hasTransparency = false;
                for (let y = 0; y < H; y++) {
                  for (let x = 0; x < W; x++) {
                    const a = px[(y * W + x) * 4 + 3];
                    if (a < 10) { hasTransparency = true; continue; }
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                  }
                }
                if (hasTransparency && maxX > minX && maxY > minY) {
                  // Add 1px padding, clamp to image bounds
                  const pad = 2;
                  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
                  maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
                  setBox({ x: minX / W, y: minY / H, w: (maxX - minX) / W, h: (maxY - minY) / H });
                } else {
                  setBox({ x: 0, y: 0, w: 1, h: 1 });
                }
              } catch {
                setBox({ x: 0, y: 0, w: 1, h: 1 });
              }
            }} />
          {/* Dark overlay */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${box.y * 100}%`, background: "#00000077" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(1 - box.y - box.h) * 100}%`, background: "#00000077" }} />
            <div style={{ position: "absolute", top: `${box.y * 100}%`, left: 0, width: `${box.x * 100}%`, height: `${box.h * 100}%`, background: "#00000077" }} />
            <div style={{ position: "absolute", top: `${box.y * 100}%`, right: 0, width: `${(1 - box.x - box.w) * 100}%`, height: `${box.h * 100}%`, background: "#00000077" }} />
          </div>
          {/* Magnifier — shows corner being dragged, positioned at opposite corner */}
          {activeHandle && activeHandle !== "drag" && (() => {
            // Position magnifier at opposite side from active handle
            const top = activeHandle.includes("s") ? "8px" : "auto";
            const bottom = activeHandle.includes("n") || (!activeHandle.includes("s") && !activeHandle.includes("n")) ? "8px" : "auto";
            const left = activeHandle.includes("e") ? "8px" : "auto";
            const right = activeHandle.includes("w") || (!activeHandle.includes("e") && !activeHandle.includes("w")) ? "8px" : "auto";
            return (
              <div style={{ position: "absolute", top, bottom, left, right, zIndex: 20, pointerEvents: "none", filter: "drop-shadow(0 2px 8px #00000088)" }}>
                <canvas ref={magCanvasRef} width={100} height={100} style={{ borderRadius: "50%", display: "block" }} />
              </div>
            );
          })()}
          <div onMouseDown={e => onDown(e, "drag")} onTouchStart={e => onDown(e, "drag")}
            style={{ position: "absolute", left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, border: "2px solid #C8102E", boxSizing: "border-box", cursor: dragging ? "grabbing" : "grab" }}>
            {[33.3, 66.6].map(p => <div key={`v${p}`} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, width: 1, background: "#ffffff33" }} />)}
            {[33.3, 66.6].map(p => <div key={`h${p}`} style={{ position: "absolute", top: `${p}%`, left: 0, right: 0, height: 1, background: "#ffffff33" }} />)}
            {handles.map(h => (
              <div key={h.id} onMouseDown={e => onDown(e, h.id)} onTouchStart={e => onDown(e, h.id)}
                style={{ position: "absolute", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, ...h.style }}>
                <div style={{
                  background: "#C8102E",
                  border: "2px solid #fff",
                  borderRadius: h.icon === "corner" ? 4 : h.icon === "h-edge" ? 3 : 3,
                  width:  h.icon === "corner" ? 12 : h.icon === "h-edge" ? 20 : 6,
                  height: h.icon === "corner" ? 12 : h.icon === "h-edge" ? 6  : 20,
                  boxShadow: "0 1px 4px #00000055",
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 10, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 12, letterSpacing: "0.1em", cursor: "pointer" }}>CANCEL</button>
          <button onClick={doCrop} style={{ flex: 2, padding: "11px", background: "#C8102E", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", boxShadow: "0 4px 14px #C8102E44" }}>✓ CROP & USE</button>
        </div>
      </div>
    </div>
  );
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
        padding: "36px 28px", width: "100%", maxWidth: "min(780px, 95vw)",
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

function TagPill({ tag, active, onClick, onRemove, T, count }) {
  return (
    <span onClick={onClick} style={{
      padding: "3px 10px", borderRadius: "999px", fontSize: 10,
      fontFamily: "'Oswald',sans-serif", letterSpacing: "0.06em",
      background: active ? "#C8102E" : (T ? T.bgCard : "#fff1e8"),
      color: active ? "#fff" : "#C8102E",
      border: `1.5px solid ${active ? "#C8102E" : "#C8102E44"}`,
      cursor: onClick || onRemove ? "pointer" : "default",
      display: "inline-flex", alignItems: "center", gap: 4,
      userSelect: "none", transition: "all 0.15s",
    }}>
      #{tag}
      {count != null && <span style={{ background: active ? "#ffffff33" : "#C8102E22", borderRadius: "999px", padding: "0px 5px", fontSize: 9, fontWeight: 700 }}>{count}</span>}
      {onRemove && <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ fontWeight: 900, opacity: 0.7 }}>×</span>}
    </span>
  );
}

function SortBar({ sort, setSort, viewMode, setViewMode, T, L }) {
  const sorts = [
    { v: "newest", l: L.sortNewest },
    { v: "oldest", l: L.sortOldest },
    { v: "az", l: L.sortAZ },
    { v: "za", l: L.sortZA },
  ];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
      <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.2em" }}>{L.sortLabel}</span>
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
        {[[["grid", L.gridView], ["tile", L.tileView]]].flat().map(([v, l]) => (
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

function AddEditModal({ T, onSave, onClose, initial = {}, extraFields = [], folder = "collection", allTags = [] }) {
  const [name, setName] = useState(initial.name || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(initial.tags || []);
  const [image, setImage] = useState(initial.image || null);
  const [note, setNote] = useState(initial.note || "");
  const [price, setPrice] = useState(initial.price || "");
  const [countries, setCountries] = useState(initial.countries || []);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [cropSrc, setCropSrc] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [dateUnknown, setDateUnknown] = useState(initial.dateUnknown || false);
  // date picker value as YYYY-MM-DD string
  const [dateVal, setDateVal] = useState(() => {
    const ts = initial.addedAt || Date.now();
    return new Date(ts).toISOString().slice(0, 10);
  });
  const fileRef = useRef();

  const getTagSuggestions = (q) => {
    if (!q.trim()) return setTagSuggestions([]);
    const low = q.toLowerCase().replace(/\s+/g, "-");
    setTagSuggestions(
      allTags.filter(t => t.includes(low) && !tags.includes(t)).slice(0, 6)
    );
  };

  const addTag = (raw) => {
    const t = (raw || tagInput).trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput(""); setTagSuggestions([]);
  };

  const handleFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    // Show cropper first
    const url = URL.createObjectURL(f);
    setPendingFile(f);
    setCropSrc(url);
  };

  const handleCropped = async (croppedFile) => {
    setCropSrc(null);
    setPendingFile(null);
    setUploading(true); setUploadErr("");
    try {
      const compressed = await compressCanPhoto(croppedFile);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "x-filename": `${folder}/${Date.now()}.jpg`,
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
      const r = new FileReader(); r.onload = e => setImage(e.target.result); r.readAsDataURL(croppedFile);
      setUploadErr(`⚠️ Blob failed (${err.message}) — saved locally`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
    {cropSrc && <CropModal src={cropSrc} T={T} quality={0.85} targetKB={150} onCrop={handleCropped} onCancel={() => { setCropSrc(null); setPendingFile(null); URL.revokeObjectURL(cropSrc); }} />}
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
      {!image && !uploading && (
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <label style={{ flex: 1, padding: "8px", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", textAlign: "center" }}>
            📷 CAMERA<input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          </label>
          <label style={{ flex: 1, padding: "8px", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", textAlign: "center" }}>
            🖼️ GALLERY<input type="file" accept="image/*,image/heic,image/heif" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          </label>
        </div>
      )}
      {image && !uploading && (
        <button onClick={() => fileRef.current.click()} style={{ width: "100%", marginBottom: 10, padding: "6px", background: "transparent", border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
          ✂️ CHANGE & RE-CROP
        </button>
      )}
      {uploadErr && <p style={{ color: "#FF6B00", fontFamily: "'Oswald',sans-serif", fontSize: 9, marginBottom: 10, letterSpacing: "0.05em" }}>{uploadErr}</p>}

      <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>CAN NAME</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fanta Orange 330ml"
        style={{ width: "100%", padding: "10px 13px", marginBottom: 12, background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />

      {extraFields.includes("note") && <>
        <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>NOTE</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Where to find it, etc."
          style={{ width: "100%", padding: "10px 13px", marginBottom: 12, background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
      </>}

      {extraFields.includes("price") && <>
        <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>PRICE (optional)</label>
        <input value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. €1.50 or $2"
          style={{ width: "100%", padding: "10px 13px", marginBottom: 12, background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
      </>}

      <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>COUNTRIES (optional)</label>
      <div style={{ marginBottom: 12 }}>
        <CountryInput value={countries} onChange={setCountries} T={T} />
      </div>

      <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>TAGS</label>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 7 }}>
          <input value={tagInput} onChange={e => { setTagInput(e.target.value); getTagSuggestions(e.target.value); }}
            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } if (e.key === "Escape") setTagSuggestions([]); if (e.key === "ArrowDown" && tagSuggestions.length > 0) { e.preventDefault(); addTag(tagSuggestions[0]); } }}
            onBlur={() => setTimeout(() => setTagSuggestions([]), 150)}
            placeholder="coca-cola, 330ml…"
            style={{ flex: 1, padding: "10px 13px", background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
          <button onClick={() => addTag()} style={{ background: "#C8102E", border: "none", borderRadius: 9, padding: "0 16px", color: "#fff", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>+</button>
        </div>
        {tagSuggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 46, background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 10, zIndex: 50, overflow: "hidden", boxShadow: "0 8px 24px #00000044", marginTop: 2 }}>
            {tagSuggestions.map(t => (
              <div key={t} onMouseDown={() => addTag(t)}
                style={{ padding: "8px 12px", cursor: "pointer", fontFamily: "'Oswald',sans-serif", fontSize: 11, color: "#C8102E", letterSpacing: "0.06em", borderBottom: `1px solid ${T.border}`, transition: "background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#C8102E15"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                #{t}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 18, minHeight: 26 }}>
        {tags.map(t => <TagPill key={t} tag={t} active T={T} onRemove={() => setTags(tags.filter(x => x !== t))} />)}
      </div>

      <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 6 }}>DATE ADDED</label>
      <div style={{ background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 18 }}>
        <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} disabled={dateUnknown}
          style={{ width: "100%", padding: "8px 10px", background: T.bgCard, border: `1.5px solid ${dateUnknown ? T.border : T.border}`, borderRadius: 8, color: dateUnknown ? T.textFaint : T.text, fontFamily: "Georgia,serif", fontSize: 13, marginBottom: 8, opacity: dateUnknown ? 0.4 : 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <div onClick={() => setDateUnknown(d => !d)} style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${dateUnknown ? "#C8102E" : T.border}`, background: dateUnknown ? "#C8102E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "#fff", transition: "all 0.15s" }}>
            {dateUnknown ? "✓" : ""}
          </div>
          <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.1em" }}>DATE UNKNOWN — got it before I started tracking</span>
        </label>
      </div>

      <button onClick={() => { if (name.trim()) onSave({ id: initial.id || Date.now().toString(), name: name.trim(), tags, image, note, price, countries, dateUnknown, addedAt: dateUnknown ? (initial.addedAt || Date.now()) : new Date(dateVal).getTime() || Date.now() }); }}
        disabled={!name.trim()}
        style={{ width: "100%", padding: "13px", background: name.trim() ? "#C8102E" : T.border, border: "none", borderRadius: 11, color: name.trim() ? "#fff" : T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.15em", cursor: name.trim() ? "pointer" : "not-allowed", boxShadow: name.trim() ? "0 4px 16px #C8102E44" : "none", transition: "all 0.2s" }}>
        {initial.id ? "SAVE CHANGES" : "ADD TO VAULT"}
      </button>
    </ModalShell>
    </>
  );
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────

function DetailModal({ T, can, isAdmin, onDelete, onEdit, onClose, onDuplicate, customColors = {}, onCountryExpanded }) {
  const color = getCanColor(can.tags, customColors);
  const [copied, setCopied] = useState(false);

  // Auto-expand any 3-letter country codes in the array on open
  useEffect(() => {
    if (!can.countries?.length) return;
    const expanded = can.countries.map(c => resolveCountry(c)?.name || c);
    const changed = expanded.some((e, i) => e !== can.countries[i]);
    if (changed) onCountryExpanded?.({ ...can, countries: expanded });
  }, [can.id]);

  const resolvedCountries = can.countries?.map(c => resolveCountry(c)).filter(Boolean) || [];

  const shareUrl = `${window.location.origin}/?can=${can.id}`;
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: can.name, text: `Check out this can: ${can.name}`, url: shareUrl });
    } else {
      navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "min(220px, 55vw)", margin: "0 auto 16px", filter: `drop-shadow(0 10px 24px ${color}66)` }}>
          {can.image
            ? <img src={can.image} alt={can.name} style={{ width: "100%", height: "auto", maxHeight: "45vh", objectFit: "contain", borderRadius: 10 }} />
            : <div style={{ width: "100%", aspectRatio: "1/1.6" }}><CanSvg color={color} name={can.name} /></div>}
        </div>
        <div style={{ display: "inline-block", background: "#C8102E", color: "#fff", fontFamily: "'Satisfy',cursive", fontSize: 24, padding: "4px 22px", borderRadius: "999px", marginBottom: 8, boxShadow: "0 4px 14px #C8102E55" }}>{can.name}</div>
        <p style={{ fontFamily: "'Oswald',sans-serif", color: T.textFaint, fontSize: 9, letterSpacing: "0.15em", marginBottom: 8 }}>
          {can.dateUnknown ? "📅 DATE UNKNOWN" : `ADDED ${new Date(can.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}`}
        </p>
        {resolvedCountries.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 8 }}>
            {resolvedCountries.map((rc, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", fontFamily: "Georgia,serif", fontSize: 12, color: T.textMuted }}>
                <FlagImg iso2={rc.iso2} name={rc.name} />{rc.name}
              </span>
            ))}
          </div>
        )}
        {can.price && <p style={{ fontFamily: "'Oswald',sans-serif", color: T.textMuted, fontSize: 11, letterSpacing: "0.1em", marginBottom: 8 }}>💰 {can.price}</p>}
        {can.note && <p style={{ fontFamily: "Georgia,serif", color: T.textMuted, fontSize: 12, fontStyle: "italic", marginBottom: 12, padding: "8px 16px", background: T.bgInput, borderRadius: 8, border: `1px solid ${T.border}` }}>"{can.note}"</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", marginBottom: 18 }}>
          {can.tags.map(t => <TagPill key={t} tag={t} T={T} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: T.border }} /><span style={{ color: "#C8102E" }}>★</span><div style={{ flex: 1, height: 1, background: T.border }} />
        </div>

        {/* Share — always visible */}
        <button onClick={handleShare} style={{ background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, padding: "9px 20px", color: copied ? "#22C55E" : T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer", marginBottom: isAdmin ? 10 : 0, transition: "color 0.2s" }}>
          {copied ? "✅ LINK COPIED!" : "🔗 SHARE CAN"}
        </button>

        {isAdmin && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onEdit} style={{ background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, padding: "9px 16px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>EDIT</button>
            <button onClick={() => onDuplicate(can)} style={{ background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, padding: "9px 16px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>📋 COPY</button>
            <button onClick={() => { onDelete(can.id); onClose(); }} style={{ background: "transparent", border: "2px solid #C8102E66", borderRadius: 9, padding: "9px 16px", color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>REMOVE</button>
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
  if (!url || !url.startsWith("http") || url.startsWith("data:")) return;
  try {
    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-canvault-auth": atob(_PH) },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) console.error("Blob delete failed:", await res.text());
  } catch (e) { console.error("Blob delete error:", e); }
}

// ─── BULK UPLOAD MODAL ────────────────────────────────────────────────────────

function BulkUploadModal({ T, onSave, onClose, folder = "collection", allTags = [] }) {
  const [queue, setQueue] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [sharedTags, setSharedTags] = useState([]);
  const [sharedCountries, setSharedCountries] = useState([]);
  const [sharedDateUnknown, setSharedDateUnknown] = useState(false);
  const [sharedDate, setSharedDate] = useState("");
  const [cropIdx, setCropIdx] = useState(null); // index of item being cropped
  const [perTagInput, setPerTagInput] = useState({}); // {idx: inputValue}
  const fileRef = useRef();

  const handleFiles = (files) => {
    const items = Array.from(files).map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      croppedFile: null, // set after cropping
      croppedUrl: null,
      name: f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
      tags: [...sharedTags],
      countries: [...sharedCountries],
      dateUnknown: sharedDateUnknown,
      date: sharedDate,
      uploading: false, done: false, url: null, err: null,
    }));
    setQueue(items);
  };

  const getTagSuggestions = (q) => {
    if (!q.trim()) return setTagSuggestions([]);
    const low = q.toLowerCase();
    setTagSuggestions(allTags.filter(t => t.includes(low) && !sharedTags.includes(t)).slice(0, 6));
  };

  const addSharedTag = (val) => {
    const t = (val || tagInput).trim().toLowerCase().replace(/\s+/g, "-");
    if (!t) return;
    if (!sharedTags.includes(t)) setSharedTags(p => [...p, t]);
    // also add to all items not yet uploaded
    setQueue(q => q.map(item => item.done ? item : { ...item, tags: item.tags.includes(t) ? item.tags : [...item.tags, t] }));
    setTagInput(""); setTagSuggestions([]);
  };

  const addItemTag = (i) => {
    const raw = (perTagInput[i] || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!raw) return;
    setQueue(q => q.map((item, idx) => idx === i && !item.tags.includes(raw) ? { ...item, tags: [...item.tags, raw] } : item));
    setPerTagInput(p => ({ ...p, [i]: "" }));
  };

  const updateItem = (i, patch) => setQueue(q => q.map((item, idx) => idx === i ? { ...item, ...patch } : item));

  const handleCropped = (i, croppedFile) => {
    const url = URL.createObjectURL(croppedFile);
    updateItem(i, { croppedFile, croppedUrl: url });
    setCropIdx(null);
  };

  const uploadAll = async () => {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.done) continue;
      updateItem(i, { uploading: true, err: null });
      try {
        const src = item.croppedFile || item.file;
        const compressed = await compressCanPhoto(src);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "image/jpeg", "x-filename": `${folder}/${Date.now()}.jpg`, "x-canvault-auth": atob(_PH) },
          body: compressed,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const { url } = await res.json();
        updateItem(i, { uploading: false, done: true, url });
        await onSave({ id: `${Date.now()}-${i}`, name: item.name.trim() || `Can ${i + 1}`, tags: item.tags, countries: item.countries || [], dateUnknown: item.dateUnknown || false, image: url, addedAt: item.dateUnknown ? Date.now() : (item.date ? new Date(item.date).getTime() || Date.now() : Date.now()) });
      } catch (err) {
        updateItem(i, { uploading: false, err: err.message });
      }
    }
  };

  const allDone = queue.length > 0 && queue.every(i => i.done);
  const anyUploading = queue.some(i => i.uploading);
  const doneCount = queue.filter(i => i.done).length;

  // Show CropModal fullscreen when cropping a bulk item
  if (cropIdx !== null && queue[cropIdx]) {
    return (
      <CropModal
        src={queue[cropIdx].croppedUrl || queue[cropIdx].previewUrl}
        T={T}
        quality={0.92}
        targetKB={150}
        originalFile={queue[cropIdx].croppedFile || queue[cropIdx].file}
        onCrop={f => handleCropped(cropIdx, f)}
        onCancel={() => setCropIdx(null)}
      />
    );
  }

  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 26, color: "#C8102E", textAlign: "center", marginBottom: 4 }}>Bulk Upload</div>
      <div style={{ width: 46, height: 3, background: "#C8102E", margin: "0 auto 14px", borderRadius: 2 }} />

      {/* Shared controls — tags, country, date */}
      <div style={{ marginBottom: 12, padding: "10px 12px", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 10 }}>
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 6 }}>SHARED — applied to every can</p>

        {/* Tags */}
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 7, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 4 }}>TAGS</p>
        <div style={{ position: "relative", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={tagInput}
              onChange={e => { setTagInput(e.target.value); getTagSuggestions(e.target.value); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSharedTag(); } if (e.key === "Escape") setTagSuggestions([]); if (e.key === "ArrowDown" && tagSuggestions.length > 0) { e.preventDefault(); addSharedTag(tagSuggestions[0]); } }}
              onBlur={() => setTimeout(() => setTagSuggestions([]), 150)}
              placeholder="330ml, limited…"
              style={{ flex: 1, padding: "7px 10px", background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontFamily: "Georgia,serif", fontSize: 12 }} />
            <button onClick={() => addSharedTag()} style={{ background: "#C8102E", border: "none", borderRadius: 7, padding: "0 12px", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>+</button>
          </div>
          {tagSuggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 46, background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 8, zIndex: 50, overflow: "hidden", boxShadow: "0 8px 24px #00000044" }}>
              {tagSuggestions.map(t => (
                <div key={t} onMouseDown={() => addSharedTag(t)}
                  style={{ padding: "7px 12px", cursor: "pointer", fontFamily: "Georgia,serif", fontSize: 12, color: T.text, borderBottom: `1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = "#C8102E22"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  #{t}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, minHeight: 16, marginBottom: 10 }}>
          {sharedTags.map(t => <TagPill key={t} tag={t} active T={T} onRemove={() => setSharedTags(p => p.filter(x => x !== t))} />)}
        </div>

        {/* Country */}
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 7, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 4 }}>COUNTRY</p>
        <CountryInput
          value={sharedCountries}
          onChange={next => {
            const added = next.find(c => !sharedCountries.includes(c));
            const removed = sharedCountries.find(c => !next.includes(c));
            setSharedCountries(next);
            if (added) setQueue(q => q.map(item => item.done ? item : { ...item, countries: item.countries.includes(added) ? item.countries : [...item.countries, added] }));
            if (removed) setQueue(q => q.map(item => ({ ...item, countries: item.countries.filter(c => c !== removed) })));
          }}
          T={T}
          placeholder="Czech Republic, Germany…"
        />

        {/* Date */}
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 7, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 4 }}>DATE ADDED</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.text, letterSpacing: "0.08em" }}>
            <input type="checkbox" checked={sharedDateUnknown} onChange={e => { setSharedDateUnknown(e.target.checked); setQueue(q => q.map(item => item.done ? item : { ...item, dateUnknown: e.target.checked })); }}
              style={{ accentColor: "#C8102E", width: 14, height: 14 }} />
            UNKNOWN DATE
          </label>
          {!sharedDateUnknown && (
            <input type="date" value={sharedDate} onChange={e => { setSharedDate(e.target.value); setQueue(q => q.map(item => item.done ? item : { ...item, date: e.target.value })); }}
              style={{ flex: 1, padding: "6px 9px", background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontFamily: "Georgia,serif", fontSize: 12 }} />
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <label style={{ display: "block", padding: "24px 20px", background: T.bgInput, border: `2px dashed ${T.border}`, borderRadius: 12, textAlign: "center", cursor: "pointer" }}>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.12em" }}>TAP TO SELECT MULTIPLE PHOTOS</p>
        </label>
      ) : (
        <>
          {/* Progress bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.1em" }}>{doneCount} / {queue.length} UPLOADED</span>
            {allDone && <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: "#22C55E" }}>✅ ALL DONE!</span>}
          </div>
          <div style={{ height: 4, background: T.border, borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#C8102E", borderRadius: 2, width: `${(doneCount / queue.length) * 100}%`, transition: "width 0.4s" }} />
          </div>

          {/* Queue */}
          <div style={{ maxHeight: "52vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {queue.map((item, i) => (
              <div key={i} style={{ background: item.done ? "#22C55E0a" : T.bgInput, border: `1.5px solid ${item.done ? "#22C55E44" : item.err ? "#FF444466" : T.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {/* Thumbnail + crop button */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img
                      src={item.croppedUrl || item.previewUrl}
                      alt=""
                      style={{ width: 120, height: 165, objectFit: "cover", borderRadius: 7, display: "block", border: item.croppedUrl ? "2px solid #C8102E" : `1px solid ${T.border}` }}
                    />
                    {!item.done && !item.uploading && (
                      <button
                        onClick={() => setCropIdx(i)}
                        title="Crop this photo"
                        style={{ position: "absolute", bottom: 2, right: 2, background: "#C8102Ecc", border: "none", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 10, cursor: "pointer", lineHeight: 1 }}
                      >✂️</button>
                    )}
                  </div>

                  {/* Name + status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      value={item.name}
                      onChange={e => updateItem(i, { name: e.target.value })}
                      disabled={item.done || item.uploading}
                      style={{ width: "100%", maxWidth: 200, padding: "6px 9px", marginBottom: 6, background: item.done ? "transparent" : T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontFamily: "Georgia,serif", fontSize: 12 }}
                    />
                    {/* Per-item tags */}
                    {!item.done && (
                      <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
                        <input
                          value={perTagInput[i] || ""}
                          onChange={e => setPerTagInput(p => ({ ...p, [i]: e.target.value }))}
                          onKeyDown={e => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addItemTag(i))}
                          placeholder="add tag…"
                          style={{ flex: 1, padding: "4px 8px", background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 6, color: T.text, fontFamily: "Georgia,serif", fontSize: 11 }}
                        />
                        <button onClick={() => addItemTag(i)} style={{ background: "#C8102E", border: "none", borderRadius: 6, padding: "0 10px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>+</button>
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {item.tags.map(t => (
                        <TagPill key={t} tag={t} T={T} onRemove={item.done ? null : () => updateItem(i, { tags: item.tags.filter(x => x !== t) })} />
                      ))}
                    </div>
                    {item.err && <p style={{ color: "#FF4444", fontFamily: "'Oswald',sans-serif", fontSize: 9, marginTop: 4 }}>❌ {item.err}</p>}
                  </div>

                  {/* Status icon */}
                  <div style={{ flexShrink: 0, fontSize: 18 }}>
                    {item.uploading ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
                      : item.done ? "✅" : item.err ? "❌" : "⏸️"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!anyUploading && !allDone && (
            <button onClick={uploadAll} style={{ width: "100%", padding: "13px", background: "#C8102E", border: "none", borderRadius: 11, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", boxShadow: "0 4px 16px #C8102E44" }}>
              ⬆️ UPLOAD {queue.length - doneCount} CANS
            </button>
          )}
          {allDone && (
            <button onClick={onClose} style={{ width: "100%", padding: "13px", background: "#22C55E", border: "none", borderRadius: 11, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer" }}>
              ✅ DONE — CLOSE
            </button>
          )}
        </>
      )}
    </ModalShell>
  );
}

// ─── BULK TAG MODAL ───────────────────────────────────────────────────────────

function BulkTagModal({ T, cans, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const [tagInput, setTagInput] = useState("");
  const [applyTags, setApplyTags] = useState([]);
  const [removeTags, setRemoveTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const allTags = [...new Set(cans.flatMap(c => c.tags))].sort();

  const toggleCan = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => s.size === cans.length ? new Set() : new Set(cans.map(c => c.id)));

  const addApplyTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !applyTags.includes(t)) setApplyTags(p => [...p, t]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    const updated = cans.map(c => {
      if (!selected.has(c.id)) return c;
      let tags = [...c.tags];
      applyTags.forEach(t => { if (!tags.includes(t)) tags.push(t); });
      removeTags.forEach(t => { tags = tags.filter(x => x !== t); });
      return { ...c, tags };
    });
    await onSave(updated.filter(c => selected.has(c.id)));
    setSaving(false);
    setDone(true);
  };

  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 26, color: "#C8102E", textAlign: "center", marginBottom: 4 }}>Bulk Edit Tags</div>
      <div style={{ width: 46, height: 3, background: "#C8102E", margin: "0 auto 14px", borderRadius: 2 }} />

      {done ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 13, color: "#22C55E", letterSpacing: "0.1em" }}>UPDATED {selected.size} CANS</p>
          <button onClick={onClose} style={{ marginTop: 16, padding: "10px 28px", background: "#C8102E", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>DONE</button>
        </div>
      ) : (
        <>
          {/* Tags to add */}
          <div style={{ marginBottom: 12, padding: "10px 12px", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 10 }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: "#22C55E", letterSpacing: "0.2em", marginBottom: 6 }}>+ TAGS TO ADD</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addApplyTag())}
                placeholder="tag to add to selected cans…"
                style={{ flex: 1, padding: "7px 10px", background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontFamily: "Georgia,serif", fontSize: 12 }} />
              <button onClick={addApplyTag} style={{ background: "#22C55E", border: "none", borderRadius: 7, padding: "0 12px", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {applyTags.map(t => <TagPill key={t} tag={t} active T={T} onRemove={() => setApplyTags(p => p.filter(x => x !== t))} />)}
            </div>
          </div>

          {/* Tags to remove */}
          <div style={{ marginBottom: 12, padding: "10px 12px", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 10 }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: "#C8102E", letterSpacing: "0.2em", marginBottom: 6 }}>− TAGS TO REMOVE (tap to mark)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {allTags.map(t => (
                <span key={t} onClick={() => setRemoveTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                  style={{ padding: "3px 10px", borderRadius: "999px", fontSize: 10, fontFamily: "'Oswald',sans-serif", letterSpacing: "0.06em", cursor: "pointer", userSelect: "none", transition: "all 0.15s",
                    background: removeTags.includes(t) ? "#C8102E" : T.bgCard,
                    color: removeTags.includes(t) ? "#fff" : "#C8102E",
                    border: `1.5px solid ${removeTags.includes(t) ? "#C8102E" : "#C8102E44"}`,
                    textDecoration: removeTags.includes(t) ? "line-through" : "none",
                  }}>#{t}</span>
              ))}
            </div>
          </div>

          {/* Can selector */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em" }}>SELECT CANS ({selected.size} selected)</p>
              <button onClick={toggleAll} style={{ background: "none", border: "none", color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 9, cursor: "pointer", textDecoration: "underline", letterSpacing: "0.1em" }}>
                {selected.size === cans.length ? "DESELECT ALL" : "SELECT ALL"}
              </button>
            </div>
            <div style={{ maxHeight: "28vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {cans.map(c => (
                <div key={c.id} onClick={() => toggleCan(c.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: selected.has(c.id) ? "#C8102E0f" : T.bgInput, border: `1.5px solid ${selected.has(c.id) ? "#C8102E66" : T.border}`, borderRadius: 8, cursor: "pointer", transition: "all 0.12s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected.has(c.id) ? "#C8102E" : T.border}`, background: selected.has(c.id) ? "#C8102E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "#fff" }}>
                    {selected.has(c.id) ? "✓" : ""}
                  </div>
                  <div style={{ width: 28, height: 40, flexShrink: 0 }}>
                    {c.image ? <img src={c.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 3 }} /> : <CanSvg color={getCanColor(c.tags)} name={c.name} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2 }}>{c.tags.slice(0, 4).map(t => <TagPill key={t} tag={t} T={T} />)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={selected.size === 0 || (applyTags.length === 0 && removeTags.length === 0) || saving}
            style={{ width: "100%", padding: "13px", background: (selected.size > 0 && (applyTags.length > 0 || removeTags.length > 0)) ? "#C8102E" : T.border, border: "none", borderRadius: 11, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", boxShadow: "0 4px 16px #C8102E33" }}>
            {saving ? "SAVING…" : `APPLY TO ${selected.size} CAN${selected.size !== 1 ? "S" : ""}`}
          </button>
        </>
      )}
    </ModalShell>
  );
}

// ─── TAG COLOR MODAL ──────────────────────────────────────────────────────────

function TagColorModal({ T, allTags, customColors, onSave, onClose }) {
  const [colors, setColors] = useState({ ...customColors });
  const [newTag, setNewTag] = useState("");
  const [newColor, setNewColor] = useState("#C8102E");
  const [newHex, setNewHex] = useState("#C8102E");
  const [editHex, setEditHex] = useState({});
  const PRESETS = ["#C8102E","#FF6B00","#FFCC00","#22C55E","#00843D","#3B82F6","#004B93","#8B5CF6","#EC4899","#14B8A6","#F97316","#888888"];
  const isValidHex = h => /^#[0-9A-Fa-f]{6}$/.test(h);

  const coloredTags = Object.keys(colors).sort();
  const builtinTags = Object.keys(BRAND_COLORS).filter(k => k !== "default" && !colors[k]).sort();



  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t) return;
    setColors(c => ({ ...c, [t]: newColor }));
    setNewTag(""); setNewColor("#C8102E"); setNewHex("#C8102E");
  };
  const updateColor = (tag, hex) => { if (!isValidHex(hex)) return; setColors(c => ({ ...c, [tag]: hex })); };
  const removeColor = (tag) => { const c = { ...colors }; delete c[tag]; setColors(c); };

  const HexField = ({ value, onChange }) => {
    const [raw, setRaw] = useState(value);
    useEffect(() => setRaw(value), [value]);
    const v = isValidHex(raw.startsWith("#") ? raw : "#" + raw);
    return (
      <input value={raw}
        onChange={e => { setRaw(e.target.value); const h = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value; if (isValidHex(h)) onChange(h); }}
        onBlur={() => { const h = raw.startsWith("#") ? raw : "#" + raw; if (!isValidHex(h)) setRaw(value); }}
        placeholder="#C8102E" maxLength={7}
        style={{ width: 82, padding: "5px 8px", background: T.bgCard, border: `1.5px solid ${v ? "#22C55E" : T.border}`, borderRadius: 7, color: T.text, fontFamily: "monospace", fontSize: 12, textAlign: "center" }} />
    );
  };

  const Swatches = ({ cur, onPick }) => (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
      {PRESETS.map(c => (
        <div key={c} onClick={() => onPick(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer", border: cur === c ? "2px solid #fff" : "2px solid transparent", boxShadow: cur === c ? `0 0 0 2px ${c}` : "none", flexShrink: 0 }} />
      ))}
      {/* Native color picker as last swatch */}
      <label title="Custom color picker" style={{ width: 22, height: 22, borderRadius: "50%", background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", cursor: "pointer", flexShrink: 0, overflow: "hidden", border: "2px solid transparent" }}>
        <input type="color" value={cur || "#C8102E"} onChange={e => onPick(e.target.value)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
      </label>
    </div>
  );

  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 26, color: "#C8102E", textAlign: "center", marginBottom: 4 }}>Tag Colors</div>
      <div style={{ width: 46, height: 3, background: "#C8102E", margin: "0 auto 14px", borderRadius: 2 }} />

      {/* Add section */}
      <div style={{ background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 8 }}>ADD COLOR TO TAG</p>
        <div style={{ display: "flex", gap: 7, marginBottom: 10, alignItems: "center" }}>
          <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} placeholder="tag name e.g. monster"
            style={{ flex: 1, padding: "7px 10px", background: T.bgCard, border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: newColor, border: "2px solid " + T.border, flexShrink: 0 }} />
          <HexField value={newHex} onChange={h => { setNewColor(h); setNewHex(h); }} />
        </div>
        <Swatches cur={newColor} onPick={c => { setNewColor(c); setNewHex(c); }} />
        <button onClick={addTag} disabled={!newTag.trim()} style={{ width: "100%", marginTop: 10, padding: "9px", background: newTag.trim() ? "#C8102E" : T.border, border: "none", borderRadius: 8, color: newTag.trim() ? "#fff" : T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", cursor: newTag.trim() ? "pointer" : "not-allowed" }}>+ ADD</button>
      </div>

      {/* Custom colored tags */}
      {coloredTags.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 8 }}>CUSTOM COLORS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "28vh", overflowY: "auto" }}>
            {coloredTags.map(tag => (
              <div key={tag} style={{ background: T.bgInput, border: `1.5px solid ${colors[tag]}44`, borderLeft: `3px solid ${colors[tag]}`, borderRadius: 9, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: colors[tag], flexShrink: 0, boxShadow: `0 0 0 2px ${colors[tag]}44` }} />
                  <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 12, color: T.text, flex: 1 }}>#{tag}</span>
                  <HexField value={editHex[tag] || colors[tag]} onChange={h => { updateColor(tag, h); setEditHex(p => ({ ...p, [tag]: h })); }} />
                  <button onClick={() => removeColor(tag)} style={{ width: 24, height: 24, background: "#FF444422", border: "1.5px solid #FF444466", borderRadius: 5, color: "#FF4444", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
                <Swatches cur={colors[tag]} onPick={c => { updateColor(tag, c); setEditHex(p => ({ ...p, [tag]: c })); }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in brands */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 8 }}>BUILT-IN BRANDS <span style={{ fontFamily: "Georgia,serif", fontSize: 9, fontStyle: "italic", letterSpacing: 0, textTransform: "none" }}>— tap to override</span></p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {builtinTags.map(tag => (
            <div key={tag} onClick={() => { setNewTag(tag); setNewColor(BRAND_COLORS[tag]); setNewHex(BRAND_COLORS[tag]); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: "999px", cursor: "pointer" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: BRAND_COLORS[tag] }} />
              <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted }}>#{tag}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => { saveCustomColors(colors); onSave(colors); onClose(); }} style={{ width: "100%", padding: "13px", background: "#C8102E", border: "none", borderRadius: 11, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", boxShadow: "0 4px 16px #C8102E44" }}>
        SAVE COLORS
      </button>
    </ModalShell>
  );
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

function CollectionPage({ T, L, isAdmin }) {
  const [cans, setCans] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Read initial state from URL params
  const searchParams = new URLSearchParams(location.search);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [activeTags, setActiveTags] = useState(() => { const t = searchParams.get("tag"); return t ? t.split(",").filter(Boolean) : []; });
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [viewMode, setViewMode] = useState(searchParams.get("view") || "grid");
  const [modal, setModal] = useState(null);
  const [pinned, setPinned] = useState(() => { try { return JSON.parse(localStorage.getItem("cv_pinned") || "[]"); } catch { return []; } });
  const [customColors, setCustomColors] = useState(() => loadCustomColors());
  const [activeCountry, setActiveCountry] = useState(searchParams.get("country") || null);

  // Sync filters to URL (skip ?can= deep links)
  useEffect(() => {
    if (skipUrlSync.current) return;
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (activeTags.length > 0) p.set("tag", activeTags.join(","));
    if (sort !== "newest") p.set("sort", sort);
    if (viewMode !== "grid") p.set("view", viewMode);
    if (activeCountry) p.set("country", activeCountry);
    const qs = p.toString();
    navigate(qs ? `/?${qs}` : "/", { replace: true });
  }, [search, activeTags, sort, viewMode, activeCountry]);

  const skipUrlSync = useRef(false);

  useEffect(() => { localStorage.setItem("cv_pinned", JSON.stringify(pinned)); }, [pinned]);

  useEffect(() => {
    if (!db.isConfigured()) { setCans(SAMPLE_CANS); setLoading(false); return; }
    db.getCans().then(rows => {
      const loaded = rows.map(db.rowToCan);
      setCans(loaded);
      setLoading(false);
      // Deep link: ?can=ID opens that can's detail modal
      const params = new URLSearchParams(window.location.search);
      const canId = params.get("can");
      if (canId) {
        const target = loaded.find(c => c.id === canId);
        if (target) setModal({ can: target });
        // Remove just the ?can= param, preserving other filter params
        params.delete("can");
        const qs = params.toString();
        skipUrlSync.current = true;
        window.history.replaceState({}, "", qs ? `/?${qs}` : "/");
        setTimeout(() => { skipUrlSync.current = false; }, 50);
      }
    }).catch(() => { setCans(SAMPLE_CANS); setLoading(false); });
  }, []);

  const tagCounts = cans.reduce((acc, can) => { can.tags.forEach(t => { acc[t] = (acc[t] || 0) + 1; }); return acc; }, {});
  const allTags = [...new Set(cans.flatMap(c => c.tags))].sort();
  const allCountries = [...new Set(cans.flatMap(c => c.countries || []).filter(Boolean))].sort();

  const baseFiltered = cans.filter(can => {
    const s = search.toLowerCase();
    const matchSearch = (!s || can.name.toLowerCase().includes(s) || can.tags.some(t => t.includes(s)));
    const matchTags = activeTags.length === 0 || activeTags.every(t => can.tags.includes(t));
    const matchCountry = !activeCountry || (can.countries || []).includes(activeCountry);
    return matchSearch && matchTags && matchCountry;
  });

  // Pinned cans always first
  const filtered = sortCans(baseFiltered.filter(c => !pinned.includes(c.id)), sort);
  const pinnedCans = baseFiltered.filter(c => pinned.includes(c.id));
  const allFiltered = [...pinnedCans, ...filtered];

  const togglePin = (id) => setPinned(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const saveCan = async (can, { closeModal = true, refetch = true } = {}) => {
    if (db.isConfigured()) {
      await db.upsertCan(can).catch(console.error);
      if (refetch) {
        const rows = await db.getCans().catch(() => null);
        if (rows) setCans(rows.map(db.rowToCan));
      } else {
        // Optimistic update — just prepend/update locally
        setCans(p => p.find(c => c.id === can.id) ? p.map(c => c.id === can.id ? can : c) : [can, ...p]);
      }
    } else {
      setCans(p => p.find(c => c.id === can.id) ? p.map(c => c.id === can.id ? can : c) : [can, ...p]);
    }
    if (closeModal) setModal(null);
  };

  const removeCan = async id => {
    const can = cans.find(c => c.id === id);
    if (db.isConfigured()) await db.deleteCan(id).catch(console.error);
    if (can?.image && can.image.startsWith("http")) await deleteFromBlob(can.image);
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
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 7 }}>{L.filterTag}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {allTags.map(tag => <TagPill key={tag} tag={tag} active={activeTags.includes(tag)} count={tagCounts[tag]} onClick={() => setActiveTags(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])} T={T} />)}
            {activeTags.length > 0 && <span onClick={() => setActiveTags([])} style={{ padding: "3px 10px", color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>{L.clear}</span>}
          </div>
        </div>
      )}

      {/* Sort + view */}
      <SortBar sort={sort} setSort={setSort} viewMode={viewMode} setViewMode={setViewMode} T={T} L={L} />

      {/* Country filter */}
      {allCountries.length > 0 && (
        <div style={{ marginBottom: 10, padding: "12px 16px", background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 11 }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 7 }}>{L.filterCountry}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allCountries.map(country => {
              const count = cans.filter(c => (c.countries || []).includes(country)).length;
              const active = activeCountry === country;
              return (
                <button key={country} onClick={() => setActiveCountry(active ? null : country)} style={{ padding: "5px 12px", borderRadius: "999px", fontFamily: "Georgia, serif", fontSize: 12, background: active ? "#C8102E" : T.bgCard, color: active ? "#fff" : T.text, border: `1.5px solid ${active ? "#C8102E" : T.border}`, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}>
                  {(() => { const rc = resolveCountry(country); return rc?.iso2 ? <FlagImg iso2={rc.iso2} name={rc.name} /> : null; })()}
                  {country}
                  <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, background: active ? "#ffffff33" : "#C8102E22", color: active ? "#fff" : "#C8102E", borderRadius: "999px", padding: "0 5px" }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats + Add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `2px dashed ${T.border}`, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em" }}>
          {allFiltered.length === cans.length ? L.cansInVault(cans.length) : L.showingOf(allFiltered.length, cans.length)}
        </span>
        {(activeTags.length > 0 || activeCountry) && (
          <button onClick={() => { setActiveTags([]); setActiveCountry(null); }} style={{ background: "none", border: "none", color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>{L.clearFilters}</button>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cans.length > 0 && (
            <button onClick={() => { const r = cans[Math.floor(Math.random() * cans.length)]; setModal({ can: r }); }} style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: "999px", padding: "7px 14px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>{L.random}</button>
          )}
          {isAdmin && (
            <>
              <button onClick={() => setModal("bulk")} style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: "999px", padding: "7px 14px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>{L.bulk}</button>
              <button onClick={() => setModal("bulktag")} style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: "999px", padding: "7px 14px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>{L.bulkTags}</button>
              <button onClick={() => setModal("colors")} style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: "999px", padding: "7px 14px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>{L.colors}</button>
              <button onClick={() => setModal("add")} style={{ background: "#C8102E", border: "none", borderRadius: "999px", padding: "7px 16px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>{L.addCan}</button>
            </>
          )}
        </div>
      </div>

      {/* Grid / Tile */}
      {allFiltered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🫙</div>
          <p style={{ fontFamily: "'Playfair Display',serif", color: T.textMuted, fontSize: 18, fontStyle: "italic" }}>{L.noCansFound}</p>
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 16 }}>
          {allFiltered.map((can, i) => <GridCard key={can.id} can={can} i={i} T={T} customColors={customColors} onClick={() => setModal({ can })} pinned={pinned.includes(can.id)} onPin={isAdmin ? () => togglePin(can.id) : null} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allFiltered.map((can, i) => <TileCard key={can.id} can={can} i={i} T={T} customColors={customColors} onClick={() => setModal({ can })} pinned={pinned.includes(can.id)} onPin={isAdmin ? () => togglePin(can.id) : null} />)}
        </div>
      )}

      {/* Modals */}
      {modal === "add" && <AddEditModal T={T} onSave={can => saveCan(can)} onClose={() => setModal(null)} allTags={allTags} />}
      {modal === "bulk" && <BulkUploadModal T={T} folder="collection" allTags={allTags} onSave={async (can) => { await saveCan(can, { closeModal: false, refetch: false }); }} onClose={() => setModal(null)} />}
      {modal === "bulktag" && <BulkTagModal T={T} cans={cans} onSave={async (updatedCans) => { for (const c of updatedCans) { await db.upsertCan(c).catch(console.error); } const rows = await db.getCans().catch(() => null); if (rows) setCans(rows.map(db.rowToCan)); }} onClose={() => setModal(null)} />}
      {modal === "colors" && <TagColorModal T={T} allTags={allTags} customColors={customColors} onSave={setCustomColors} onClose={() => setModal(null)} />}
      {modal?.can && !modal.edit && (
        <DetailModal T={T} can={modal.can} isAdmin={isAdmin} customColors={customColors}
          onDelete={id => { removeCan(id); setModal(null); }}
          onEdit={() => setModal({ can: modal.can, edit: true })}
          onDuplicate={can => { saveCan({ ...can, id: Date.now().toString(), name: can.name + " (copy)", addedAt: Date.now() }); setModal(null); }}
          onCountryExpanded={async updated => {
            if (db.isConfigured()) await db.upsertCan(updated).catch(console.error);
            setCans(p => p.map(c => c.id === updated.id ? updated : c));
          }}
          onClose={() => setModal(null)} />
      )}
      {modal?.can && modal.edit && (
        <AddEditModal T={T} initial={modal.can} onSave={saveCan} onClose={() => setModal(null)} allTags={allTags} />
      )}
      </>}
    </div>
  );
}

function GridCard({ can, i, T, onClick, pinned, onPin, customColors = {} }) {
  const color = getCanColor(can.tags, customColors);
  return (
    <div onClick={onClick} style={{ background: T.bgCard, border: `2px solid ${pinned ? "#C8102E88" : T.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", animation: `popIn 0.3s cubic-bezier(.34,1.56,.64,1) ${i * 0.04}s both`, boxShadow: T.isDark ? "0 4px 20px #00000055" : "0 3px 12px #00000010,0 1px 0 #fff inset", transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1),box-shadow 0.22s,border-color 0.18s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px) rotate(-1deg)"; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 12px 30px ${color}33`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = pinned ? "#C8102E88" : T.border; e.currentTarget.style.boxShadow = T.isDark ? "0 4px 20px #00000055" : "0 3px 12px #00000010,0 1px 0 #fff inset"; }}>
      <div style={{ width: "100%", aspectRatio: "3/4", background: T.isDark ? "#060d18" : "#FFF0DC", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${color}22 0%, transparent 70%)` }} />
        {onPin && (
          <button onClick={e => { e.stopPropagation(); onPin(); }} style={{ position: "absolute", top: 6, left: 6, background: pinned ? "#C8102E" : "#00000044", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 11, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            {pinned ? "📌" : "📍"}
          </button>
        )}
        <div style={{ width: "55%", height: "80%", position: "relative" }}>
          {can.image ? <img src={can.image} alt={can.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <CanSvg color={color} name={can.name} />}
        </div>
      </div>
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 11, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>{can.name}</div>
      </div>
    </div>
  );
}

function TileCard({ can, i, T, onClick, pinned, onPin, customColors = {} }) {
  const color = getCanColor(can.tags, customColors);
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
        {can.dateUnknown ? "?" : new Date(can.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </div>
      <div style={{ color: T.border, fontSize: 16 }}>›</div>
    </div>
  );
}

// ─── WISHLIST PAGE ────────────────────────────────────────────────────────────

function WishlistPage({ T, L, isAdmin }) {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [viewMode, setViewMode] = useState(searchParams.get("view") || "grid");
  const [activeTags, setActiveTags] = useState(() => { const t = searchParams.get("tag"); return t ? t.split(",").filter(Boolean) : []; });
  const [activeCountry, setActiveCountry] = useState(searchParams.get("country") || null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (activeTags.length > 0) p.set("tag", activeTags.join(","));
    if (sort !== "newest") p.set("sort", sort);
    if (viewMode !== "grid") p.set("view", viewMode);
    if (activeCountry) p.set("country", activeCountry);
    const qs = p.toString();
    navigate(qs ? `/wishlist?${qs}` : "/wishlist", { replace: true });
  }, [activeTags, sort, viewMode, activeCountry]);

  useEffect(() => {
    if (!db.isConfigured()) { setWishes(SAMPLE_WISHLIST); setLoading(false); return; }
    db.getWishlist().then(rows => { setWishes(rows.map(db.rowToWish)); setLoading(false); })
      .catch(() => { setWishes(SAMPLE_WISHLIST); setLoading(false); });
  }, []);

  const allTags = [...new Set(wishes.flatMap(w => w.tags))].sort();
  const tagCounts = wishes.reduce((acc, w) => { w.tags.forEach(t => { acc[t] = (acc[t] || 0) + 1; }); return acc; }, {});

  // All unique countries that have been filled in
  const allCountries = [...new Set(wishes.flatMap(w => w.countries || []).filter(Boolean))].sort();

  const sorted = sortCans(wishes.filter(w => {
    const tagMatch = activeTags.length === 0 || activeTags.every(t => w.tags.includes(t));
    const countryMatch = !activeCountry || (w.countries || []).includes(activeCountry);
    return tagMatch && countryMatch;
  }), sort);

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
    if (wish?.image && wish.image.startsWith("http")) await deleteFromBlob(wish.image);
    setWishes(p => p.filter(w => w.id !== id));
  };

  const activeFilters = activeTags.length + (activeCountry ? 1 : 0);

  return (
    <div>
      <div style={{ background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 36 }}>⭐</div>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.text, fontWeight: 700 }}>{L.wishlistTitle}</div>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", marginTop: 2 }}>{L.wishlistSub} · {wishes.length}</div>
        </div>
      </div>

      {loading ? <LoadingSpinner T={T} /> : <>
      <SortBar sort={sort} setSort={setSort} viewMode={viewMode} setViewMode={setViewMode} T={T} L={L} />

      {/* Country filter */}
      {allCountries.length > 0 && (
        <div style={{ marginBottom: 10, padding: "12px 16px", background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 11 }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 7 }}>{L.filterCountry}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allCountries.map(country => {
              const count = wishes.filter(w => (w.countries || []).includes(country)).length;
              const active = activeCountry === country;
              return (
                <button key={country} onClick={() => setActiveCountry(active ? null : country)} style={{
                  padding: "5px 12px", borderRadius: "999px",
                  fontFamily: "Georgia, serif", fontSize: 12,
                  background: active ? "#C8102E" : T.bgCard,
                  color: active ? "#fff" : T.text,
                  border: `1.5px solid ${active ? "#C8102E" : T.border}`,
                  cursor: "pointer", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {country}
                  <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, background: active ? "#ffffff33" : "#C8102E22", color: active ? "#fff" : "#C8102E", borderRadius: "999px", padding: "0 5px" }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 14, padding: "12px 16px", background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 11 }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 7 }}>{L.filterTag}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {allTags.map(tag => <TagPill key={tag} tag={tag} active={activeTags.includes(tag)} count={tagCounts[tag]} onClick={() => setActiveTags(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])} T={T} />)}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `2px dashed ${T.border}`, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em" }}>
            {sorted.length === wishes.length ? L.wishCount(wishes.length) : L.showingOf(sorted.length, wishes.length)}
          </span>
          {activeFilters > 0 && (
            <button onClick={() => { setActiveTags([]); setActiveCountry(null); }} style={{ background: "none", border: "none", color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 10, cursor: "pointer", textDecoration: "underline", letterSpacing: "0.1em" }}>
              {L.clearFilters}
            </button>
          )}
        </div>
        {isAdmin && <button onClick={() => setModal("add")} style={{ background: "#C8102E", border: "none", borderRadius: "999px", padding: "7px 16px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>{L.addWish}</button>}
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>⭐</div>
          <p style={{ fontFamily: "'Playfair Display',serif", color: T.textMuted, fontSize: 18, fontStyle: "italic" }}>
            {activeFilters > 0 ? L.noWishesFiltered : L.noWishes}
          </p>
          {isAdmin && activeFilters === 0 && <p style={{ fontFamily: "Georgia,serif", color: T.textFaint, fontSize: 12, marginTop: 6 }}>{L.noWishesHint}</p>}
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

      {modal === "add" && <AddEditModal T={T} extraFields={["note","price"]} folder="wishlist" onSave={saveWish} onClose={() => setModal(null)} allTags={allTags} />}
      {modal?.wish && !modal.edit && (
        <WishDetailModal T={T} wish={modal.wish} isAdmin={isAdmin}
          onDelete={id => { removeWish(id); setModal(null); }}
          onEdit={() => setModal({ wish: modal.wish, edit: true })}
          onCountryExpanded={async updated => {
            if (db.isConfigured()) await db.upsertWish(updated).catch(console.error);
            setWishes(p => p.map(w => w.id === updated.id ? updated : w));
          }}
          onMarkFound={async (wish) => {
            const newCan = { id: Date.now().toString(), name: wish.name, image: wish.image, tags: wish.tags, note: wish.note, countries: wish.countries || [], price: "", addedAt: Date.now() };
            if (db.isConfigured()) await db.upsertCan(newCan).catch(console.error);
            removeWish(wish.id);
            setModal(null);
          }}
          onClose={() => setModal(null)} />
      )}
      {modal?.wish && modal.edit && (
        <AddEditModal T={T} initial={modal.wish} extraFields={["note","price"]} folder="wishlist" onSave={saveWish} onClose={() => setModal(null)} allTags={allTags} />
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

function WishDetailModal({ T, wish, isAdmin, onDelete, onEdit, onClose, onMarkFound, onCountryExpanded }) {
  const color = getCanColor(wish.tags);
  const [foundMode, setFoundMode] = useState(false);
  const [newImage, setNewImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    if (!wish.countries?.length) return;
    const expanded = wish.countries.map(c => resolveCountry(c)?.name || c);
    const changed = expanded.some((e, i) => e !== wish.countries[i]);
    if (changed) onCountryExpanded?.({ ...wish, countries: expanded });
  }, [wish.id]);

  const resolvedCountries = wish.countries?.map(c => resolveCountry(c)).filter(Boolean) || [];

  const handleFoundFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setCropSrc(URL.createObjectURL(f));
  };

  const handleCropped = async (croppedFile) => {
    setCropSrc(null);
    setUploading(true);
    try {
      const compressed = await compressCanPhoto(croppedFile);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg", "x-filename": `collection/${Date.now()}.jpg`, "x-canvault-auth": atob(_PH) },
        body: compressed,
      });
      if (res.ok) { const { url } = await res.json(); setNewImage(url); }
      else { const r = new FileReader(); r.onload = e => setNewImage(e.target.result); r.readAsDataURL(croppedFile); }
    } catch { const r = new FileReader(); r.onload = e => setNewImage(e.target.result); r.readAsDataURL(croppedFile); }
    setUploading(false);
  };

  if (cropSrc) return <CropModal src={cropSrc} T={T} quality={0.85} targetKB={150} onCrop={handleCropped} onCancel={() => setCropSrc(null)} />;

  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: "#C8102E", letterSpacing: "0.2em", marginBottom: 10 }}>★ ON MY WISHLIST ★</div>
        <div style={{ width: 80, height: 120, margin: "0 auto 14px", opacity: 0.8, filter: `grayscale(20%) drop-shadow(0 8px 20px ${color}55)` }}>
          {wish.image ? <img src={wish.image} alt={wish.name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }} /> : <CanSvg color={color} name={wish.name} />}
        </div>
        <div style={{ display: "inline-block", background: "#C8102E", color: "#fff", fontFamily: "'Satisfy',cursive", fontSize: 22, padding: "4px 20px", borderRadius: "999px", marginBottom: 8 }}>{wish.name}</div>
        {wish.price && <p style={{ fontFamily: "'Oswald',sans-serif", color: T.textMuted, fontSize: 12, letterSpacing: "0.1em", margin: "6px 0" }}>💰 {wish.price}</p>}
        {resolvedCountries.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 8 }}>
            {resolvedCountries.map((rc, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", fontFamily: "Georgia,serif", fontSize: 12, color: T.textMuted }}>
                <FlagImg iso2={rc.iso2} name={rc.name} />{rc.name}
              </span>
            ))}
          </div>
        )}
        {wish.note && <p style={{ fontFamily: "Georgia,serif", color: T.textMuted, fontSize: 12, fontStyle: "italic", margin: "10px 0", padding: "8px 14px", background: T.bgInput, borderRadius: 8, border: `1px solid ${T.border}` }}>"{wish.note}"</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", marginTop: 10, marginBottom: 16 }}>
          {wish.tags.map(t => <TagPill key={t} tag={t} T={T} />)}
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {!foundMode ? (
              <>
                <button onClick={() => setFoundMode(true)} style={{ background: "#22C55E", border: "none", borderRadius: 9, padding: "9px 16px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>✅ FOUND IT!</button>
                <button onClick={onEdit} style={{ background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, padding: "9px 16px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>EDIT</button>
                <button onClick={() => { onDelete(wish.id); onClose(); }} style={{ background: "transparent", border: "2px solid #C8102E66", borderRadius: 9, padding: "9px 16px", color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>REMOVE</button>
              </>
            ) : (
              <div style={{ width: "100%", background: T.bgInput, border: `2px solid #22C55E44`, borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: "#22C55E", letterSpacing: "0.2em", marginBottom: 10 }}>🎉 FOUND IT! REPLACE PHOTO?</p>
                {uploading ? (
                  <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, textAlign: "center" }}>⏳ UPLOADING…</p>
                ) : newImage ? (
                  <div style={{ textAlign: "center", marginBottom: 10 }}>
                    <img src={newImage} alt="" style={{ height: 80, borderRadius: 8, objectFit: "contain" }} />
                    <button onClick={() => setNewImage(null)} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 9, cursor: "pointer", textDecoration: "underline" }}>CHANGE</button>
                  </div>
                ) : (
                  <label style={{ display: "block", padding: "10px", background: T.bgCard, border: `2px dashed ${T.border}`, borderRadius: 9, textAlign: "center", cursor: "pointer", marginBottom: 10 }}>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFoundFile(e.target.files[0])} />
                    <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.1em" }}>📸 TAP TO ADD NEW PHOTO</span>
                  </label>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setFoundMode(false)} style={{ flex: 1, padding: "9px", background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 9, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>CANCEL</button>
                  <button onClick={() => { onMarkFound({ ...wish, image: newImage || wish.image }); onClose(); }}
                    style={{ flex: 2, padding: "9px", background: "#22C55E", border: "none", borderRadius: 9, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>
                    ✅ MOVE TO COLLECTION
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── CAN WALL PAGE ────────────────────────────────────────────────────────────

function CanWallPage({ T, L, isAdmin }) {
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
  const [cropSrc, setCropSrc] = useState(null);
  const [pendingEditFile, setPendingEditFile] = useState(null);

  const handleFile = (f) => {
    if (!f) return;
    const isImage = f.type.startsWith("image/") || f.name?.match(/\.(heic|heif)$/i);
    if (!isImage) return;
    setPendingEditFile(f);
    setCropSrc(URL.createObjectURL(f));
  };

  const handleCropped = async (croppedFile) => {
    setCropSrc(null);
    setUploading(true); setUploadErr("");
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "x-filename": `wall/${Date.now()}.jpg`,
          "x-canvault-auth": atob(_PH),
        },
        body: croppedFile,
      });
      if (res.ok) {
        const { url } = await res.json();
        setNewImage(url);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(`${res.status}: ${err.error || "unknown"}`);
      }
    } catch (err) {
      const r = new FileReader(); r.onload = e => setNewImage(e.target.result); r.readAsDataURL(croppedFile);
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
    if (photo?.image && photo.image.startsWith("http")) await deleteFromBlob(photo.image);
    setPhotos(p => p.filter(x => x.id !== id));
  };

  return (
    <div>
      <div style={{ background: T.stripe, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 36 }}>📸</div>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.text, fontWeight: 700 }}>{L.canwallTitle}</div>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", marginTop: 2 }}>{L.canWallSub} · {photos.length}</div>
        </div>
        {isAdmin && (
          <button onClick={() => setAddModal(true)} style={{ marginLeft: "auto", background: "#C8102E", border: "none", borderRadius: "999px", padding: "8px 18px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>{L.addPhoto}</button>
        )}
      </div>

      {loading ? <LoadingSpinner T={T} /> : photos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", border: `2px dashed ${T.border}`, borderRadius: 14, background: T.stripe }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🗄️</div>
          <p style={{ fontFamily: "'Playfair Display',serif", color: T.textMuted, fontSize: 20, fontStyle: "italic", marginBottom: 6 }}>{L.noWallPhotos}</p>
          {isAdmin
            ? <p style={{ fontFamily: "Georgia,serif", color: T.textFaint, fontSize: 12 }}>{L.noWallPhotosHint}</p>
            : <p style={{ fontFamily: "Georgia,serif", color: T.textFaint, fontSize: 12 }}>{L.signInToAdd}</p>}
          {isAdmin && (
            <button onClick={() => setAddModal(true)} style={{ marginTop: 18, background: "#C8102E", border: "none", borderRadius: "999px", padding: "10px 24px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer", boxShadow: "0 4px 16px #C8102E44" }}>{L.uploadFirst}</button>
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

      {/* Crop modal for wall photos — no compression, just crop at max quality */}
      {cropSrc && <CropModal src={cropSrc} T={T} quality={0.97} targetKB={3900} originalFile={pendingEditFile} onCrop={handleCropped} onCancel={() => { setCropSrc(null); setPendingEditFile(null); URL.revokeObjectURL(cropSrc); }} />}

      {/* Add photo modal */}
      {addModal && (
        <ModalShell onClose={() => { setAddModal(false); setNewImage(null); setNewCaption(""); }} T={T}>
          <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 28, color: "#C8102E", textAlign: "center", marginBottom: 4 }}>{L.addPhotoTitle}</div>
          <div style={{ width: 46, height: 3, background: "#C8102E", margin: "0 auto 18px", borderRadius: 2 }} />
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ border: `2px dashed ${drag ? "#C8102E" : T.border}`, borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer", marginBottom: 14, background: drag ? "#C8102E08" : T.bgInput, transition: "all 0.2s", minHeight: 140, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, position: "relative", overflow: "hidden" }}>
            <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", zIndex: 2 }} onChange={e => handleFile(e.target.files[0])} />
            {uploading
              ? <><span style={{ fontSize: 36, animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9 }}>{L.loading}</p></>
              : newImage
                ? <img src={newImage} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 8, objectFit: "contain", position: "relative", zIndex: 1 }} />
                : <><span style={{ fontSize: 40 }}>🖼️</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9, letterSpacing: "0.12em" }}>{L.tapToUpload}</p></>}
          </div>
          {newImage && !uploading && (
            <button onClick={() => { setNewImage(null); fileRef.current.click(); }} style={{ width: "100%", marginBottom: 10, padding: "6px", background: "transparent", border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>{L.changeRecrop}</button>
          )}
          {uploadErr && <p style={{ color: "#FF6B00", fontFamily: "'Oswald',sans-serif", fontSize: 9, marginBottom: 8 }}>{uploadErr}</p>}
          <label style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", display: "block", marginBottom: 5 }}>{L.caption}</label>
          <input value={newCaption} onChange={e => setNewCaption(e.target.value)} placeholder="e.g. My bedroom shelf, Jan 2025"
            style={{ width: "100%", padding: "10px 13px", marginBottom: 16, background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.text, fontFamily: "Georgia,serif", fontSize: 13 }} />
          <button onClick={addPhoto} disabled={!newImage}
            style={{ width: "100%", padding: "13px", background: newImage ? "#C8102E" : T.border, border: "none", borderRadius: 11, color: newImage ? "#fff" : T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.15em", cursor: newImage ? "pointer" : "not-allowed", boxShadow: newImage ? "0 4px 16px #C8102E44" : "none", transition: "all 0.2s" }}>
            {L.addToWall}
          </button>
        </ModalShell>
      )}

      {/* Lightbox */}
      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000000ee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={viewPhoto.image} alt={viewPhoto.caption || ""} style={{ maxWidth: "95vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 12, boxShadow: "0 0 80px #00000099" }} />
          {viewPhoto.caption && <p style={{ fontFamily: "'Satisfy',cursive", color: "#FFE8D0", fontSize: 22, marginTop: 16, textShadow: "0 2px 8px #000" }}>{viewPhoto.caption}</p>}
          <p style={{ fontFamily: "'Oswald',sans-serif", color: "#ffffff55", fontSize: 10, letterSpacing: "0.2em", marginTop: 8 }}>{L.clickToClose}</p>
        </div>
      )}
    </div>
  );
}

// ─── BLOB MIGRATION TOOL ──────────────────────────────────────────────────────
// Moves images that are at root of Blob (no folder) into collection/ folder
// and updates Supabase with the new URL

function MigrateBlobTool({ T, cans, wishes, wallPhotos, onDone }) {
  const [state, setState] = useState("idle"); // idle | running | done
  const [log, setLog] = useState([]);
  const [count, setCount] = useState({ done: 0, fail: 0, total: 0 });
  const [brokenItems, setBrokenItems] = useState(null); // null = not scanned yet
  const [scanning, setScanning] = useState(false);

  const addLog = (msg) => setLog(p => [...p, msg]);

  const needsFolder = (url) =>
    url && url.startsWith("http") && !url.includes("data:") &&
    !/\/(collection|wishlist|wall)\//.test(url);

  const toMigrate = [
    ...cans.filter(c => needsFolder(c.image)).map(c => ({ item: c, type: "can", folder: "collection", label: c.name })),
    ...wishes.filter(w => needsFolder(w.image)).map(w => ({ item: w, type: "wish", folder: "wishlist", label: w.name })),
    ...(wallPhotos || []).filter(p => needsFolder(p.image)).map(p => ({ item: p, type: "wall", folder: "wall", label: p.caption || p.id })),
  ];

  // Check for items whose image URL returns a 404 (prev migration uploaded but didn't update Supabase)
  const scanBroken = async () => {
    setScanning(true);
    const allItems = [
      ...cans.filter(c => c.image?.startsWith("http")).map(c => ({ item: c, type: "can", label: c.name })),
      ...wishes.filter(w => w.image?.startsWith("http")).map(w => ({ item: w, type: "wish", label: w.name })),
    ];
    const broken = [];
    await Promise.all(allItems.map(async ({ item, type, label }) => {
      try {
        const res = await fetch(item.image, { method: "HEAD", cache: "no-store" });
        if (!res.ok) broken.push({ item, type, label, status: res.status });
      } catch {
        broken.push({ item, type, label, status: "network error" });
      }
    }));
    setBrokenItems(broken);
    setScanning(false);
  };

  const run = async () => {
    if (toMigrate.length === 0) { addLog("✅ All images already in folders — nothing to migrate!"); return; }
    setState("running");
    setCount({ done: 0, fail: 0, total: toMigrate.length });
    const updatedCans = {}, updatedWishes = {}, updatedWall = {};

    for (const { item, type, folder, label } of toMigrate) {
      try {
        addLog(`⬆️ [${folder}/] ${label}…`);

        // Fetch the image — use no-cors as fallback to handle Blob CDN CORS headers
        let imgBlob;
        try {
          const imgRes = await fetch(item.image);
          if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
          imgBlob = await imgRes.blob();
        } catch (fetchErr) {
          // Try again via a proxy-style re-fetch with no cache
          const imgRes2 = await fetch(item.image + "?t=" + Date.now());
          if (!imgRes2.ok) throw new Error(`Fetch failed: ${fetchErr.message}`);
          imgBlob = await imgRes2.blob();
        }

        if (!imgBlob || imgBlob.size === 0) throw new Error("Fetched image is empty — file may be inaccessible");

        const upRes = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": imgBlob.type || "image/jpeg",
            "x-filename": `${folder}/${Date.now()}.jpg`,
            "x-canvault-auth": atob(_PH),
          },
          body: imgBlob,
        });

        const upText = await upRes.text();
        if (!upRes.ok) throw new Error(`Upload failed ${upRes.status}: ${upText}`);
        let newUrl;
        try { newUrl = JSON.parse(upText).url; } catch { throw new Error(`Upload response not JSON: ${upText.slice(0, 80)}`); }
        if (!newUrl) throw new Error("Upload returned no URL");

        // Update Supabase with new URL
        if (type === "can") { await db.upsertCan({ ...item, image: newUrl }); updatedCans[item.id] = newUrl; }
        else if (type === "wish") { await db.upsertWish({ ...item, image: newUrl }); updatedWishes[item.id] = newUrl; }
        else if (type === "wall") { await db.updateWallPhoto({ ...item, image: newUrl }); updatedWall[item.id] = newUrl; }

        // Delete old blob
        await deleteFromBlob(item.image);

        addLog(`✅ ${label} → ${folder}/`);
        setCount(c => ({ ...c, done: c.done + 1 }));
      } catch (err) {
        addLog(`❌ Failed: ${label} — ${err.message}`);
        setCount(c => ({ ...c, fail: c.fail + 1 }));
      }
    }

    setState("done");
    onDone({ cans: updatedCans, wishes: updatedWishes, wall: updatedWall });
  };

  // Always render — even if nothing to migrate, the broken checker is useful
  // Group counts by folder for the summary
  const byFolder = toMigrate.reduce((acc, { folder }) => { acc[folder] = (acc[folder] || 0) + 1; return acc; }, {});

  return (
    <div style={{ width: "100%", background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>
        🗂️ BLOB FOLDER MIGRATION
      </p>
      {state === "idle" && (
        <>
          {toMigrate.length > 0 ? (
            <>
              <p style={{ fontFamily: "Georgia,serif", fontSize: 12, color: T.text, marginBottom: 8 }}>
                Found <strong>{toMigrate.length}</strong> image{toMigrate.length !== 1 ? "s" : ""} in the Blob root (no folder). This moves them into the correct folders and updates Supabase.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {Object.entries(byFolder).map(([folder, n]) => (
                  <span key={folder} style={{ padding: "3px 10px", background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: "999px", fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.08em" }}>
                    {folder === "collection" ? "🥤" : folder === "wishlist" ? "⭐" : "📸"} {n} → <code>{folder}/</code>
                  </span>
                ))}
              </div>
              <button onClick={run} style={{ background: "#C8102E", border: "none", borderRadius: 10, padding: "10px 22px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer" }}>
                ▶ MIGRATE {toMigrate.length} IMAGE{toMigrate.length !== 1 ? "S" : ""}
              </button>
            </>
          ) : (
            <p style={{ fontFamily: "Georgia,serif", fontSize: 12, color: "#22C55E", fontStyle: "italic", marginBottom: 10 }}>✅ All images already in folders.</p>
          )}

          {/* Broken image scanner */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px dashed ${T.border}` }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 6 }}>🔍 BROKEN IMAGE CHECKER</p>
            <p style={{ fontFamily: "Georgia,serif", fontSize: 11, color: T.textFaint, fontStyle: "italic", marginBottom: 8 }}>
              Checks if any Supabase records point to deleted/missing Blob files (e.g. from a failed migration).
            </p>
            {brokenItems === null && !scanning && (
              <button onClick={scanBroken} style={{ background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "7px 16px", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>
                CHECK FOR BROKEN IMAGES
              </button>
            )}
            {scanning && <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted }}>⏳ Checking URLs…</p>}
            {brokenItems !== null && !scanning && (
              brokenItems.length === 0
                ? <p style={{ fontFamily: "Georgia,serif", fontSize: 12, color: "#22C55E", fontStyle: "italic" }}>✅ No broken image URLs found!</p>
                : <div>
                    <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: "#FF6B00", letterSpacing: "0.1em", marginBottom: 8 }}>
                      ⚠️ {brokenItems.length} RECORD{brokenItems.length !== 1 ? "S" : ""} WITH BROKEN IMAGE URL
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                      {brokenItems.map(({ item, type, label, status }) => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#FF6B0011", border: `1.5px solid #FF6B0033`, borderRadius: 7 }}>
                          <span style={{ fontSize: 14 }}>{type === "can" ? "🥤" : "⭐"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: "#FF6B00", letterSpacing: "0.05em" }}>{status} · {item.image?.split("/").slice(-2).join("/")}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontFamily: "Georgia,serif", fontSize: 11, color: T.textFaint, fontStyle: "italic" }}>
                      Open each item and re-upload the photo to fix it.
                    </p>
                  </div>
            )}
          </div>
        </>
      )}
      {(state === "running" || state === "done") && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
            {[["✅ Done", count.done, "#22C55E"], ["❌ Failed", count.fail, "#FF4444"], ["Total", count.total, T.textMuted]].map(([l, v, c]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textFaint, letterSpacing: "0.1em" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 4, background: T.border, borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#22C55E", borderRadius: 2, width: `${((count.done + count.fail) / Math.max(count.total, 1)) * 100}%`, transition: "width 0.3s" }} />
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto", background: T.bgInput, borderRadius: 8, padding: "8px 10px", fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.05em", lineHeight: 1.8 }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          {state === "done" && <p style={{ fontFamily: "Georgia,serif", fontSize: 11, color: "#22C55E", marginTop: 8, fontStyle: "italic" }}>Migration complete! Refresh to see updated images.</p>}
        </>
      )}
    </div>
  );
}

// ─── STATS PAGE ───────────────────────────────────────────────────────────────

function StatsPage({ T, L }) {
  const [cans, setCans] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [wallPhotos, setWallPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [c, w, wp] = await Promise.all([
          db.isConfigured() ? db.getCans() : Promise.resolve(SAMPLE_CANS),
          db.isConfigured() ? db.getWishlist() : Promise.resolve(SAMPLE_WISHLIST),
          db.isConfigured() ? db.getWallPhotos() : Promise.resolve([]),
        ]);
        setCans(db.isConfigured() ? c.map(db.rowToCan) : c);
        setWishes(db.isConfigured() ? w.map(db.rowToWish) : w);
        setWallPhotos(db.isConfigured() ? wp.map(db.rowToPhoto) : []);
      } catch { setCans(SAMPLE_CANS); setWishes(SAMPLE_WISHLIST); setWallPhotos([]); }
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) return <LoadingSpinner T={T} />;

  const tagCounts = cans.reduce((acc, c) => { c.tags.forEach(t => { acc[t] = (acc[t] || 0) + 1; }); return acc; }, {});
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const customColors = loadCustomColors();
  const brandTags = [...new Set([
    ...Object.keys(BRAND_COLORS).filter(b => b !== "default"),
    ...Object.keys(customColors),
  ])];
  const brandCounts = brandTags.map(b => ({ brand: b, count: cans.filter(c => c.tags.includes(b)).length, color: customColors[b] || BRAND_COLORS[b] || "#C8102E" })).filter(b => b.count > 0).sort((a, b) => b.count - a.count);

  // Growth by month
  const byMonth = {};
  cans.forEach(c => {
    const d = new Date(c.addedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });
  const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const maxMonth = Math.max(...months.map(m => m[1]), 1);

  const Stat = ({ label, value, sub }) => (
    <div style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, fontWeight: 900, color: "#C8102E" }}>{value}</div>
      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontFamily: "Georgia,serif", fontSize: 11, color: T.textFaint, marginTop: 2, fontStyle: "italic" }}>{sub}</div>}
    </div>
  );

  // Export JSON
  const exportJSON = () => {
    const data = { cans, wishlist: wishes, exportedAt: new Date().toISOString(), total: cans.length };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `canvault-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label="CANS IN VAULT" value={cans.length} />
        <Stat label="ON WISHLIST" value={wishes.length} />
        <Stat label="UNIQUE TAGS" value={Object.keys(tagCounts).length} />
        <Stat label="BRANDS" value={brandCounts.length} />
        <Stat label="NEWEST" value="📅" sub={cans.length ? new Date(Math.max(...cans.map(c => c.addedAt))).toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : "—"} />
        <Stat label="OLDEST" value="🗄️" sub={cans.length ? new Date(Math.min(...cans.map(c => c.addedAt))).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "—"} />
      </div>

      {/* Growth chart */}
      {months.length > 1 && (
        <div style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
          <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 14 }}>CANS ADDED PER MONTH</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {months.map(([month, count]) => (
              <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textMuted }}>{count}</div>
                <div style={{ width: "100%", background: "#C8102E", borderRadius: "3px 3px 0 0", height: `${(count / maxMonth) * 60}px`, minHeight: 4, transition: "height 0.5s" }} />
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textFaint, letterSpacing: "0.05em" }}>{month.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Brand breakdown */}
        {brandCounts.length > 0 && (
          <div style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 12 }}>BRANDS</p>
            {brandCounts.slice(0, 8).map(({ brand, count, color }) => (
              <div key={brand} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 11, color: T.text, flex: 1, letterSpacing: "0.05em" }}>{brand}</div>
                <div style={{ flex: 2, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: color, width: `${(count / brandCounts[0].count) * 100}%`, borderRadius: 3 }} />
                </div>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, minWidth: 20, textAlign: "right" }}>{count}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top tags */}
        {topTags.length > 0 && (
          <div style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.2em", marginBottom: 12 }}>TOP TAGS</p>
            {topTags.map(([tag, count]) => (
              <div key={tag} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: "#C8102E", flex: 1 }}>#{tag}</div>
                <div style={{ flex: 2, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#C8102E", width: `${(count / topTags[0][1]) * 100}%`, borderRadius: 3 }} />
                </div>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, minWidth: 20, textAlign: "right" }}>{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* On This Day */}
      {(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisDay = now.getDate();
        const onThisDay = cans.filter(c => {
          if (c.dateUnknown) return false;
          const d = new Date(c.addedAt);
          return d.getMonth() === thisMonth && d.getDate() === thisDay && d.getFullYear() !== now.getFullYear();
        });
        if (onThisDay.length === 0) return null;
        const customColors = loadCustomColors();
        return (
          <div style={{ background: T.bgCard, border: `2px solid #C8102E44`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: "#C8102E", letterSpacing: "0.2em", marginBottom: 4 }}>📅 ON THIS DAY</p>
            <p style={{ fontFamily: "Georgia,serif", fontSize: 11, color: T.textMuted, fontStyle: "italic", marginBottom: 12 }}>
              You added {onThisDay.length} can{onThisDay.length !== 1 ? "s" : ""} on {now.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} in past years
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {onThisDay.map(c => {
                const color = getCanColor(c.tags, customColors);
                const year = new Date(c.addedAt).getFullYear();
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.bgInput, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "7px 10px", minWidth: 0 }}>
                    <div style={{ width: 28, height: 42, flexShrink: 0 }}>
                      {c.image ? <img src={c.image} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 3 }} /> : <CanSvg color={color} name={c.name} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 12, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{c.name}</div>
                      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textFaint, letterSpacing: "0.1em" }}>{year} · {now.getFullYear() - year}yr ago</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Export */}
      <div style={{ paddingTop: 16, borderTop: `2px dashed ${T.border}`, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <button onClick={exportJSON} style={{ background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 12, padding: "12px 28px", color: T.text, fontFamily: "'Oswald',sans-serif", fontSize: 13, letterSpacing: "0.15em", cursor: "pointer" }}>
          {L.exportBtn}
        </button>
        <p style={{ fontFamily: "Georgia,serif", fontSize: 10, color: T.textFaint, fontStyle: "italic" }}>Downloads a JSON file with your full collection + wishlist</p>

        {/* Migration tool */}
        <MigrateBlobTool T={T} cans={cans} wishes={wishes} wallPhotos={wallPhotos}
          onDone={({ cans: uc, wishes: uw }) => {
            if (uc) setCans(p => p.map(c => uc[c.id] ? { ...c, image: uc[c.id] } : c));
            if (uw) setWishes(p => p.map(w => uw[w.id] ? { ...w, image: uw[w.id] } : w));
          }} />
        <OrphanCleanupTool T={T} cans={cans} wishes={wishes} />
      </div>
    </div>
  );
}

// ─── ORPHAN BLOB CLEANUP TOOL ─────────────────────────────────────────────────
// Finds Blob images not referenced by any can or wish, and deletes them.

function OrphanCleanupTool({ T, cans, wishes }) {
  const [state, setState] = useState("idle"); // idle | scanning | confirm | deleting | done
  const [orphans, setOrphans] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [log, setLog] = useState([]);
  const [count, setCount] = useState({ done: 0, fail: 0, total: 0 });

  const addLog = (msg) => setLog(p => [...p, msg]);

  // Normalize Blob URLs — Vercel sometimes returns public.blob.vercel-storage.com
  // but Supabase stores blob.vercel-storage.com (or vice versa). Normalize both.
  const normalizeUrl = (url) => url?.replace(/^https:\/\/[^/]+\.blob\.vercel-storage\.com/, "BLOB") || "";
  const normalizePathname = (url) => {
    try { return new URL(url).pathname; } catch { return url; }
  };

  // All known URLs referenced in Supabase — indexed both by normalized URL and pathname
  const knownNormalized = new Set([
    ...cans.map(c => c.image).filter(Boolean).map(normalizeUrl),
    ...wishes.map(w => w.image).filter(Boolean).map(normalizeUrl),
  ]);
  const knownPathnames = new Set([
    ...cans.map(c => c.image).filter(Boolean).map(normalizePathname),
    ...wishes.map(w => w.image).filter(Boolean).map(normalizePathname),
  ]);

  const isKnown = (blobUrl) =>
    knownNormalized.has(normalizeUrl(blobUrl)) ||
    knownPathnames.has(normalizePathname(blobUrl));

  const scan = async () => {
    setState("scanning");
    setLog([]);
    setOrphans([]);
    try {
      addLog("🔍 Fetching Blob file list…");
      const res = await fetch("/api/list-blobs", {
        headers: { "x-canvault-auth": atob(_PH) },
      });
      if (!res.ok) throw new Error(`API returned ${res.status} — make sure api/list-blobs.mjs exists`);
      const { blobs } = await res.json();
      addLog(`📦 Found ${blobs.length} files in Blob storage`);

      const found = blobs.filter(b =>
        b.url && b.url.startsWith("http") &&
        !isKnown(b.url)
      );
      addLog(`🗑️ ${found.length} orphaned file${found.length !== 1 ? "s" : ""} not referenced by any can or wish`);
      setOrphans(found);
      setSelected(new Set(found.map(b => b.url)));
      setState("confirm");
    } catch (err) {
      addLog(`❌ Scan failed: ${err.message}`);
      setState("idle");
    }
  };

  const deleteSelected = async () => {
    const toDelete = orphans.filter(b => selected.has(b.url));
    setState("deleting");
    setCount({ done: 0, fail: 0, total: toDelete.length });
    for (const blob of toDelete) {
      try {
        await deleteFromBlob(blob.url);
        addLog(`✅ Deleted: ${blob.pathname || blob.url.split("/").pop()}`);
        setCount(c => ({ ...c, done: c.done + 1 }));
      } catch (err) {
        addLog(`❌ Failed: ${blob.pathname || blob.url} — ${err.message}`);
        setCount(c => ({ ...c, fail: c.fail + 1 }));
      }
    }
    setState("done");
  };

  const toggleAll = () => setSelected(s => s.size === orphans.length ? new Set() : new Set(orphans.map(b => b.url)));

  return (
    <div style={{ width: "100%", background: T.bgCard, border: `2px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginTop: 12 }}>
      <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>
        🗑️ ORPHAN BLOB CLEANUP
      </p>

      {state === "idle" && (
        <>
          <p style={{ fontFamily: "Georgia,serif", fontSize: 12, color: T.text, marginBottom: 10 }}>
            Scans Blob storage for images not referenced by any can or wishlist item, then lets you delete them to free up space.
          </p>
          <button onClick={scan} style={{ background: "#C8102E", border: "none", borderRadius: 10, padding: "10px 22px", color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer" }}>
            🔍 SCAN FOR ORPHANS
          </button>
        </>
      )}

      {state === "scanning" && (
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 11, color: T.textMuted, letterSpacing: "0.1em" }}>⏳ Scanning…</p>
      )}

      {state === "confirm" && (
        <>
          {orphans.length === 0 ? (
            <p style={{ fontFamily: "Georgia,serif", fontSize: 13, color: "#22C55E", fontStyle: "italic" }}>✅ No orphaned files found — Blob storage is clean!</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: "#C8102E", letterSpacing: "0.1em" }}>
                  {selected.size} OF {orphans.length} SELECTED FOR DELETION
                </p>
                <button onClick={toggleAll} style={{ background: "none", border: "none", color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 9, cursor: "pointer", textDecoration: "underline", letterSpacing: "0.1em" }}>
                  {selected.size === orphans.length ? "DESELECT ALL" : "SELECT ALL"}
                </button>
              </div>
              <div style={{ maxHeight: "28vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                {orphans.map(b => {
                  const filename = b.pathname || b.url.split("/").pop();
                  const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
                  return (
                    <div key={b.url} onClick={() => setSelected(s => { const n = new Set(s); n.has(b.url) ? n.delete(b.url) : n.add(b.url); return n; })}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: selected.has(b.url) ? "#C8102E0f" : T.bgInput, border: `1.5px solid ${selected.has(b.url) ? "#C8102E44" : T.border}`, borderRadius: 8, cursor: "pointer", transition: "all 0.12s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected.has(b.url) ? "#C8102E" : T.border}`, background: selected.has(b.url) ? "#C8102E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "#fff" }}>
                        {selected.has(b.url) ? "✓" : ""}
                      </div>
                      {isImg && <img src={b.url} alt="" style={{ width: 32, height: 48, objectFit: "contain", borderRadius: 3, flexShrink: 0, opacity: 0.8 }} onError={e => e.target.style.display = "none"} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.05em" }}>{filename}</div>
                        <div style={{ fontFamily: "Georgia,serif", fontSize: 9, color: T.textFaint, fontStyle: "italic" }}>{b.size ? `${(b.size / 1024).toFixed(0)} KB` : ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setState("idle"); setOrphans([]); setLog([]); }} style={{ flex: 1, padding: "9px", background: T.bgInput, border: `2px solid ${T.border}`, borderRadius: 9, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>CANCEL</button>
                <button onClick={deleteSelected} disabled={selected.size === 0}
                  style={{ flex: 2, padding: "9px", background: selected.size > 0 ? "#C8102E" : T.border, border: "none", borderRadius: 9, color: "#fff", fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: selected.size > 0 ? "pointer" : "not-allowed" }}>
                  🗑️ DELETE {selected.size} FILE{selected.size !== 1 ? "S" : ""}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {(state === "deleting" || state === "done") && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            {[["✅ Deleted", count.done, "#22C55E"], ["❌ Failed", count.fail, "#FF4444"], ["Total", count.total, T.textMuted]].map(([l, v, c]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 9, color: T.textFaint, letterSpacing: "0.1em" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 4, background: T.border, borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#22C55E", borderRadius: 2, width: `${((count.done + count.fail) / Math.max(count.total, 1)) * 100}%`, transition: "width 0.3s" }} />
          </div>
          <div style={{ maxHeight: 140, overflowY: "auto", background: T.bgInput, borderRadius: 8, padding: "8px 10px", fontFamily: "'Oswald',sans-serif", fontSize: 10, color: T.textMuted, letterSpacing: "0.05em", lineHeight: 1.8 }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          {state === "done" && <p style={{ fontFamily: "Georgia,serif", fontSize: 11, color: "#22C55E", marginTop: 8, fontStyle: "italic" }}>Done! {count.done} file{count.done !== 1 ? "s" : ""} deleted.</p>}
        </>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(false);
  const [cz, setCz] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("cv_admin") === "1");
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const T = {
    isDark: dark,
    bg: dark ? "#060d18" : "#FFF5E6",
    bgCard: dark ? "#0a1525" : "#FFFBF5",
    bgInput: dark ? "#0d1c30" : "#fff",
    border: dark ? "#1a3050" : "#E8C4A0",
    text: dark ? "#C8DEFA" : "#2A0A0A",
    textMuted: dark ? "#5A7FA8" : "#8B4040",
    textFaint: dark ? "#2A4A6A" : "#C8A080",
    accent: "#C8102E",
    stripe: dark
      ? "repeating-linear-gradient(180deg,#060d18 0px,#060d18 24px,#081222 24px,#081222 48px)"
      : "repeating-linear-gradient(180deg,#FFF5E6 0px,#FFF5E6 24px,#FFF0DC 24px,#FFF0DC 48px)",
  };

  // All UI strings — switch between EN and CZ
  const L = cz ? {
    collection: "Sbírka", wishlist: "Přání", canwall: "Stěna", stats: "Statistiky",
    collectionTitle: "Sbírka plechovek", wishlistTitle: "Přání", canwallTitle: "Stěna plechovek", statsTitle: "Statistiky",
    collectionSub: "Kolekce plechovek", tagline: "KAŽDÁ PLECHOVKA MÁ PŘÍBĚH",
    signIn: "🔐 Přihlásit", signOut: "Odhlásit",
    addCan: "+ Přidat", bulk: "📦 Hromadně", bulkTags: "🏷️ Štítky", colors: "🎨 Barvy",
    random: "🎲 Náhodná", filterTag: "FILTROVAT DLE ŠTÍTKU", filterCountry: "🌍 FILTROVAT DLE ZEMĚ",
    clear: "zrušit", clearFilters: "zrušit filtry", cansInVault: (n) => `${n} PLECHOVEK VE SBÍRCE`,
    showingOf: (n, t) => `ZOBRAZENO ${n} Z ${t}`,
    noCansFound: "Žádné plechovky nenalezeny",
    wishlistSub: "PLECHOVKY, KTERÉ CHCI NAJÍT",
    wishCount: (n) => `${n} POLOŽEK`,
    addWish: "+ Přidat přání", noWishes: "Žádná přání", noWishesFiltered: "Žádná přání v tomto filtru", noWishesHint: "Přidej plechovky, které hledáš!",
    markFound: "✅ Mám ji!", edit: "Upravit", remove: "Odstranit", copy: "📋 Kopírovat", share: "🔗 Sdílet",
    linkCopied: "✅ Odkaz zkopírován!",
    addCanTitle: "Přidat plechovku", editCanTitle: "Upravit",
    saveChanges: "ULOŽIT ZMĚNY", addToVault: "PŘIDAT DO SBÍRKY",
    canName: "NÁZEV PLECHOVKY", tags: "ŠTÍTKY", note: "POZNÁMKA", price: "CENA", countries: "ZEMĚ",
    tapToUpload: "Klepni pro nahrání fotky", changeRecrop: "✂️ ZMĚNIT A OŘÍZNOUT",
    addWishTitle: "Přidat přání", canWallSub: "FOTKY POLICE A STĚNY",
    addPhoto: "+ Přidat foto", uploadFirst: "NAHRÁT PRVNÍ FOTO",
    addPhotoTitle: "Přidat foto na stěnu", caption: "POPIS (volitelný)", addToWall: "PŘIDAT NA STĚNU",
    noWallPhotos: "Zatím žádné fotky", noWallPhotosHint: "Nahraj fotku své police nebo výstavky!", signInToAdd: "Přihlas se pro přidání fotek.",
    clickToClose: "KLIKNI KAMKOLIV PRO ZAVŘENÍ",
    signInTitle: "Vítej!", signInSub: "PŘÍSTUP POUZE PRO SBĚRATELE", signInBtn: "PŘIHLÁSIT",
    wrongPw: "Špatné heslo. Zkus znovu.", collectorsOnly: "Jen pro sběratele 🥤",
    loading: "NAČÍTÁNÍ…",
    uploadAll: "⬆️ NAHRÁT", donClose: "✅ HOTOVO — ZAVŘÍT",
    sharedTags: "SDÍLENÉ ŠTÍTKY — přidány ke všem",
    sortLabel: "ŘADIT:", sortNewest: "Nejnovější", sortOldest: "Nejstarší", sortAZ: "A → Z", sortZA: "Z → A",
    gridView: "⊞ MŘÍŽKA", tileView: "▤ SEZNAM",
    onWishlist: "★ NA MÉM PŘÁNÍ ★", addedOn: "PŘIDÁNO",
    foundItTitle: "NALEZENO", est: "★ ZAL. 2020 ★", every: "★ KAŽDÁ PLECHOVKA SE POČÍTÁ ★",
    exportBtn: "💾 EXPORTOVAT ZÁLOHU JSON",
  } : {
    collection: "Collection", wishlist: "Wishlist", canwall: "Can Wall", stats: "Stats",
    collectionTitle: "The Collection", wishlistTitle: "Wishlist", canwallTitle: "Can Wall", statsTitle: "Stats",
    collectionSub: "SODA CAN COLLECTION", tagline: "★ EVERY CAN TELLS A STORY ★",
    signIn: "🔐 Sign in", signOut: "Sign out",
    addCan: "+ Add Can", bulk: "📦 Bulk", bulkTags: "🏷️ Tags", colors: "🎨 Colors",
    random: "🎲 Random", filterTag: "FILTER BY TAG", filterCountry: "🌍 FILTER BY COUNTRY",
    clear: "clear", clearFilters: "clear filters", cansInVault: (n) => `${n} CANS IN VAULT`,
    showingOf: (n, t) => `SHOWING ${n} OF ${t}`,
    noCansFound: "No cans found",
    wishlistSub: "CANS I WANT TO FIND",
    wishCount: (n) => `${n} ITEMS`,
    addWish: "+ Add Wish", noWishes: "No wishes yet", noWishesFiltered: "No wishes match these filters", noWishesHint: "Add cans you're hunting for!",
    markFound: "✅ Found it!", edit: "Edit", remove: "Remove", copy: "📋 Copy", share: "🔗 Share Can",
    linkCopied: "✅ Link copied!",
    addCanTitle: "Add a Can", editCanTitle: "Edit",
    saveChanges: "SAVE CHANGES", addToVault: "ADD TO VAULT",
    canName: "CAN NAME", tags: "TAGS", note: "NOTE", price: "PRICE", countries: "COUNTRIES",
    tapToUpload: "TAP TO UPLOAD PHOTO", changeRecrop: "✂️ CHANGE & RE-CROP",
    addWishTitle: "Add a Wish", canWallSub: "SHELF & WALL PHOTOS",
    addPhoto: "+ Add Photo", uploadFirst: "UPLOAD FIRST PHOTO",
    addPhotoTitle: "Add Wall Photo", caption: "CAPTION (optional)", addToWall: "ADD TO WALL",
    noWallPhotos: "No wall photos yet", noWallPhotosHint: "Upload a photo of your collection shelves!", signInToAdd: "Sign in to add photos.",
    clickToClose: "CLICK ANYWHERE TO CLOSE",
    signInTitle: "Welcome!", signInSub: "COLLECTOR ACCESS ONLY", signInBtn: "SIGN IN",
    wrongPw: "Incorrect password. Please try again.", collectorsOnly: "Collectors only 🥤",
    loading: "LOADING…",
    uploadAll: "⬆️ UPLOAD ALL", donClose: "✅ DONE — CLOSE",
    sharedTags: "SHARED TAGS — added to every can",
    sortLabel: "SORT:", sortNewest: "Newest", sortOldest: "Oldest", sortAZ: "A → Z", sortZA: "Z → A",
    gridView: "⊞ GRID", tileView: "▤ TILE",
    onWishlist: "★ ON MY WISHLIST ★", addedOn: "ADDED",
    foundItTitle: "FOUND IT", est: "★ EST. 2020 ★", every: "★ EVERY CAN COUNTS ★",
    exportBtn: "💾 EXPORT BACKUP JSON",
  };

  const NAV = [
    { id: "collection", path: "/", label: L.collection, icon: "🥤", title: L.collectionTitle },
    { id: "wishlist", path: "/wishlist", label: L.wishlist, icon: "⭐", title: L.wishlistTitle },
    { id: "wall", path: "/canwall", label: L.canwall, icon: "📸", title: L.canwallTitle },
    { id: "stats", path: "/stats", label: L.stats, icon: "📊", title: L.statsTitle },
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
          {[L.est, L.every].map(t => (
            <span key={t} style={{ color: "#FFE8D0", fontFamily: "'Oswald',sans-serif", fontSize: 9, letterSpacing: "0.2em", whiteSpace: "nowrap" }}>{t}</span>
          ))}
        </div>

        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 38, height: 38, background: "#FFF5E6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #FFE8D0", fontSize: 20 }}>🥤</div>
            <div>
              <div style={{ fontFamily: "'Satisfy',cursive", fontSize: 26, color: "#FFF5E6", lineHeight: 1, textShadow: "2px 2px 0 #7a0000" }}>CanVault</div>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 7, color: "#FFD0C0", letterSpacing: "0.2em" }}>{L.collectionSub}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Czech mode toggle */}
            <button onClick={() => setCz(c => !c)} style={{ background: cz ? "#FFF5E6" : "#8a0000", border: `2px solid ${cz ? "#FFE8D0" : "#5a0000"}`, borderRadius: "999px", padding: "5px 10px", color: cz ? "#C8102E" : "#FFF5E6", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Oswald',sans-serif", letterSpacing: "0.05em", lineHeight: 1 }}>
              🇨🇿
            </button>
            {/* Dark mode toggle */}
            <button onClick={() => setDark(d => !d)} style={{ background: dark ? "#FFF5E6" : "#8a0000", border: `2px solid ${dark ? "#FFE8D0" : "#5a0000"}`, borderRadius: "999px", padding: "7px 11px", color: dark ? "#C8102E" : "#FFF5E6", fontSize: 15, cursor: "pointer", lineHeight: 1 }}>
              {dark ? "☀️" : "🌙"}
            </button>
            <button onClick={() => setMenuOpen(m => !m)} style={{ background: menuOpen ? "#FFF5E6" : "#8a0000", border: `2px solid ${menuOpen ? "#FFE8D0" : "#5a0000"}`, borderRadius: 10, padding: "7px 12px", color: menuOpen ? "#C8102E" : "#FFF5E6", cursor: "pointer", fontSize: 18, lineHeight: 1, fontWeight: 700 }}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

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
                ? <button onClick={() => { setIsAdmin(false); localStorage.removeItem("cv_admin"); setMenuOpen(false); }} style={{ width: "100%", padding: "12px", background: "transparent", border: "2px solid #FFD0C055", borderRadius: 11, color: "#FFD0C0", fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}>{L.signOut.toUpperCase()}</button>
                : <button onClick={() => { setShowLogin(true); setMenuOpen(false); }} style={{ width: "100%", padding: "12px", background: "#FFF5E6", border: "2px solid #FFE8D0", borderRadius: 11, color: "#C8102E", fontFamily: "'Oswald',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}>{L.signIn}</button>
              }
            </div>
          </div>
        )}
      </header>

      {/* HERO BAND */}
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
          <Route path="/" element={<CollectionPage T={T} L={L} isAdmin={isAdmin} />} />
          <Route path="/wishlist" element={<WishlistPage T={T} L={L} isAdmin={isAdmin} />} />
          <Route path="/canwall" element={<CanWallPage T={T} L={L} isAdmin={isAdmin} />} />
          <Route path="/stats" element={<StatsPage T={T} L={L} />} />
          <Route path="*" element={<CollectionPage T={T} L={L} isAdmin={isAdmin} />} />
        </Routes>
      </main>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 20px", borderTop: `2px dashed ${T.border}`, marginTop: 20 }}>
        <p style={{ fontFamily: "'Satisfy',cursive", fontSize: 22, color: "#C8102E" }}>CanVault</p>
        <p style={{ fontFamily: "'Oswald',sans-serif", fontSize: 8, color: T.textFaint, letterSpacing: "0.2em", marginTop: 4 }}>{L.tagline}</p>
        <a href="mailto:tondatonc@gmail.com" style={{ fontFamily: "Georgia,serif", fontSize: 11, color: T.textMuted, marginTop: 10, display: "inline-block", textDecoration: "none", fontStyle: "italic" }}>tondatonc@gmail.com</a>
      </div>

      {showLogin && <LoginModal T={T} L={L} onLogin={() => { setIsAdmin(true); localStorage.setItem("cv_admin", "1"); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
    </div>
  );
}
