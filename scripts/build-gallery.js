/* =============================================================
   build-gallery.js
   Scans assets/img/ and writes assets/img/manifest.json — the list
   of image files the Work album loads automatically.
   Run by the GitHub Action whenever images are added/removed.
   Uses only Node built-ins (no dependencies).
   ============================================================= */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "assets", "img");
const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);

// Files that live in assets/img/ but are site chrome (logos, etc.),
// not portfolio pieces — keep them out of the Work gallery.
const ignore = new Set([
  "Failnauqht_Outline_wide.png",
  // The About page avatar — it lives here but isn't portfolio work.
  "profile-patt.webp",
]);

let files = [];
try {
  files = fs
    .readdirSync(dir)
    .filter((f) => exts.has(path.extname(f).toLowerCase()) && !ignore.has(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
} catch (e) {
  console.warn("assets/img not found:", e.message);
}

fs.writeFileSync(
  path.join(dir, "manifest.json"),
  JSON.stringify(files, null, 2) + "\n"
);
console.log(`Gallery manifest written: ${files.length} image(s).`);
