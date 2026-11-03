// low.js — minimal CanVault page for low-power devices (e.g. e-readers).
// No React, no service worker, no fonts or animations. Photos load only when
// the user taps "Show photo", one at a time.
import * as db from "./db.js";

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
let cans = [];

function countryNames(c) {
  return (c.countries || []).join(", ");
}

function render(filter) {
  const q = filter.trim().toLowerCase();
  listEl.textContent = "";
  const shown = cans.filter(c => {
    if (!q) return true;
    const hay = [c.name, ...(c.tags || []), ...(c.countries || [])].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  statusEl.textContent = shown.length + " of " + cans.length + " cans";
  shown.forEach(c => {
    const row = document.createElement("div");
    row.className = "row";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = c.name || "(no name)";
    row.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "meta";
    const parts = [];
    if (c.tags && c.tags.length) parts.push(c.tags.join(", "));
    if (countryNames(c)) parts.push(countryNames(c));
    meta.textContent = parts.join(" · ");
    row.appendChild(meta);

    if (c.image) {
      const btn = document.createElement("button");
      btn.textContent = "Show photo";
      btn.addEventListener("click", () => {
        btn.remove();
        const img = document.createElement("img");
        img.alt = c.name || "";
        img.src = c.image;
        row.appendChild(img);
      });
      row.appendChild(btn);
    }
    listEl.appendChild(row);
  });
}

async function start() {
  if (!db.isConfigured()) {
    statusEl.textContent = "Database is not configured for this build.";
    return;
  }
  try {
    const rows = await db.getCans();
    cans = (rows || []).map(db.rowToCan);
    searchEl.disabled = false;
    searchEl.addEventListener("input", () => render(searchEl.value));
    render("");
  } catch (err) {
    statusEl.textContent = "Could not load cans. Try reloading. (" + (err && err.message ? err.message : err) + ")";
  }
}

start();
