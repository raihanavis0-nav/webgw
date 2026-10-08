const limiter = require("../../server/thoughts-rate-limit");
const reader = require("../../server/thoughts-public");
const store = require("../../server/thoughts-store");

function bodyObject(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (_) {
    return {};
  }
}



// Public-only appearance metadata for the password gate: never expose stories.
function cleanImage(value) {
  const path = String(value || "");
  return /^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(?:gif|webp|jpg|jpeg|png)$/i.test(path) && !path.includes("..") ? path : "";
}
function cleanSlot(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return {
    image: cleanImage(source.image),
    ratio: ["3:1", "5:1", "16:9", "4:3", "1:1", "3:4", "9:16", "1:3", "1:5"].includes(source.ratio) ? source.ratio : fallback,
    x: Math.min(100, Math.max(0, source.x == null ? 50 : Number(source.x))),
    y: Math.min(100, Math.max(0, source.y == null ? 50 : Number(source.y))),
    zoom: Math.min(250, Math.max(100, Number(source.zoom) || 100)),
  };
}
async function appearanceHandler(req, res) {
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
}

module.exports = async function handler(req, res) {
  reader.noStore(res);

  if (req.method === "GET") {
    if (req.query && req.query.appearance === "1") return appearanceHandler(req, res);
    return res.status(200).json({
      configured: reader.isConfigured(),
      authenticated: Boolean(reader.sessionFromRequest(req)),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!reader.requireSameOrigin(req, res)) return;

  const body = bodyObject(req);
  const action = String(body.action || "");

  if (action === "lock") {
    reader.clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (action !== "unlock") {
    return res.status(400).json({ error: "Unknown auth action." });
  }

  if (!reader.isConfigured()) {
    return res.status(503).json({
      error: "Reader access is not configured yet.",
    });
  }

  const attempt = limiter.check(req, res, "reader-unlock", {
    maxFailures: 8,
    windowMs: 15 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  });

  if (!attempt.allowed) {
    return res.status(429).json({
      error: "Too many failed attempts. Try again later.",
    });
  }

  const code = String(body.code || "").slice(0, 256);

  if (!reader.codeMatches(code)) {
    limiter.recordFailure(attempt);
    await new Promise(function (resolve) {
      setTimeout(resolve, 450);
    });
    return res.status(401).json({ error: "Wrong access code." });
  }

  limiter.reset(attempt);
  reader.setSessionCookie(res);
  return res.status(200).json({ ok: true });
};
