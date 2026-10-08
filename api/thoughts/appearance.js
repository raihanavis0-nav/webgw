const store = require("../../server/thoughts-store");

// Public-only appearance metadata for the password gate: never expose stories.
function cleanImage(value) {
  const path = String(value || "");
  return /^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(?:gif|webp|jpg|jpeg|png)$/i.test(path) && !path.includes("..") ? path : "";
}
function cleanSlot(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return {
    image: cleanImage(source.image),
    ratio: ["3:1", "5:1", "16:9", "4:3", "1:1", "3:4", "9:16"].includes(source.ratio) ? source.ratio : fallback,
    x: Math.min(100, Math.max(0, Number(source.x) || 50)),
    y: Math.min(100, Math.max(0, Number(source.y) || 50)),
    zoom: Math.min(250, Math.max(100, Number(source.zoom) || 100)),
  };
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const library = await store.readPublicLibrary();
    const source = library.data && library.data.appearance || {};
    return res.status(200).json({
      appearance: {
        title: String(source.title || "Archive").slice(0, 120),
        subtitle: String(source.subtitle || "Choose a series and discover its world.").slice(0, 280),
        accent: /^#[0-9a-fA-F]{6}$/.test(source.accent || "") ? source.accent : "#92785b",
        login: cleanSlot(source.login, "4:3"),
        hero: cleanSlot(source.hero, "3:1"),
      }
    });
  } catch (error) {
    console.error("Reader appearance:", error);
    return res.status(502).json({ error: "Could not load appearance settings." });
  }
};
