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
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
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
  const [box, setBox] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
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
    canvas.getContext("2d").drawImage(img,
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
      <div onClick={e => e.stopPropagation()} style={{ background: T.bgCard, border: `3px solid ${T.border}`, borderRadius: 16, padding: 14, width: "100%", maxWidth: 600, maxHeight: "95vh", display: "flex", flexDirection: "column", gap: 10, animation: "popIn 0.2s ease" }}>

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
        <div className="crop-area" style={{ position: "relative", width: "100%", touchAction: "none", userSelect: "none", borderRadius: 8, overflow: "hidden" }}
          onMouseMove={onMoveWithRatio} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchMove={onMoveWithRatio} onTouchEnd={onUp}>
          <img ref={imgRef} src={src} alt="crop" style={{ width: "100%", display: "block" }}
            onLoad={() => setBox(b => ({ ...b }))} />
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
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [cropSrc, setCropSrc] = useState(null); // raw src for cropper
  const [pendingFile, setPendingFile] = useState(null); // file before crop
  const fileRef = useRef();

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
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
    </>
  );
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────

function DetailModal({ T, can, isAdmin, onDelete, onEdit, onClose }) {
  const color = getCanColor(can.tags);
  return (
    <ModalShell onClose={onClose} T={T}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "min(220px, 55vw)", margin: "0 auto 16px", filter: `drop-shadow(0 10px 24px ${color}66)` }}>
          {can.image
            ? <img src={can.image} alt={can.name} style={{ width: "100%", height: "auto", maxHeight: "45vh", objectFit: "contain", borderRadius: 10 }} />
            : <div style={{ width: "100%", aspectRatio: "1/1.6" }}><CanSvg color={color} name={can.name} /></div>}
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
    if (wish?.image && wish.image.startsWith("http")) await deleteFromBlob(wish.image);
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
  const [cropSrc, setCropSrc] = useState(null);

  const handleFile = (f) => {
    if (!f) return;
    const isImage = f.type.startsWith("image/") || f.name?.match(/\.(heic|heif)$/i);
    if (!isImage) return;
    const url = URL.createObjectURL(f);
    setCropSrc(url);
  };

  const handleCropped = async (croppedFile) => {
    setCropSrc(null);
    setUploading(true); setUploadErr("");
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "x-filename": `wall-${Date.now()}.jpg`,
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

      {/* Crop modal for wall photos — no compression, just crop at max quality */}
      {cropSrc && <CropModal src={cropSrc} T={T} quality={0.97} targetKB={3900} onCrop={handleCropped} onCancel={() => { setCropSrc(null); URL.revokeObjectURL(cropSrc); }} />}

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
            <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", zIndex: 2 }} onChange={e => handleFile(e.target.files[0])} />
            {uploading
              ? <><span style={{ fontSize: 36, animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9 }}>UPLOADING…</p></>
              : newImage
                ? <img src={newImage} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 8, objectFit: "contain", position: "relative", zIndex: 1 }} />
                : <><span style={{ fontSize: 40 }}>🖼️</span><p style={{ color: T.textFaint, fontFamily: "'Oswald',sans-serif", fontSize: 9, letterSpacing: "0.12em" }}>TAP TO UPLOAD PHOTO</p><p style={{ color: T.textFaint, fontFamily: "Georgia,serif", fontSize: 11, fontStyle: "italic" }}>Your shelf, your wall, your display</p></>}
          </div>
          {newImage && !uploading && (
            <button onClick={() => { setNewImage(null); fileRef.current.click(); }} style={{ width: "100%", marginBottom: 10, padding: "6px", background: "transparent", border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.textMuted, fontFamily: "'Oswald',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>✂️ CHANGE & RE-CROP</button>
          )}
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
