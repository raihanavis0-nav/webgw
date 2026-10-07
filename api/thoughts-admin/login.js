const limiter = require("../../server/thoughts-rate-limit");
const admin = require("../../server/thoughts-admin");

function bodyObject(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (_) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  admin.noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!admin.requireSameOrigin(req, res)) return;

  if (!admin.isConfigured()) {
    return res.status(503).json({
      error: "Admin is not configured yet. Add the required Vercel environment variables.",
    });
  }

  const attempt = limiter.check(req, res, "admin-login", {
    maxFailures: 6,
    windowMs: 15 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  });

  if (!attempt.allowed) {
    return res.status(429).json({
      error: "Too many failed attempts. Try again later.",
    });
  }

  const body = bodyObject(req);
  const username = String(body.username || "").slice(0, 128);
  const password = String(body.password || "").slice(0, 512);

  if (!admin.loginMatches(username, password)) {
    limiter.recordFailure(attempt);
    await new Promise(function (resolve) {
      setTimeout(resolve, 450);
    });
    return res.status(401).json({ error: "Wrong username or password." });
  }

  limiter.reset(attempt);
  admin.setSessionCookie(res, admin.adminUsername());
  return res.status(200).json({
    ok: true,
    username: admin.adminUsername(),
  });
};
