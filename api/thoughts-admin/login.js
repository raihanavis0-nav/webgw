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

// The same Serverless Function handles admin login, logout, and session.
// Vercel rewrites preserve the existing public endpoint URLs.
function authenticationOperation(req) {
  var action = req && req.query && req.query.authAction;
  return typeof action === "string" ? action : "login";
}

function logoutHandler(req, res) {
  admin.noStore(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!admin.requireSameOrigin(req, res)) return;
  admin.clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

function sessionHandler(req, res) {
  admin.noStore(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!admin.isConfigured()) {
    return res.status(200).json({ configured: false, authenticated: false });
  }
  var session = admin.sessionFromRequest(req);
  return res.status(200).json({
    configured: true,
    authenticated: Boolean(session),
    username: session ? session.u : null,
  });
}

module.exports = async function handler(req, res) {
  // Existing routes are rewritten to this handler. Preserve method-specific
  // CSRF protection and cookie semantics rather than redirecting requests.
  const operation = authenticationOperation(req);
  if (operation === "logout") return logoutHandler(req, res);
  if (operation === "session") return sessionHandler(req, res);
  if (operation !== "login") return res.status(404).json({ error: "Unknown authentication action." });
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

  const attempt = await limiter.checkAsync(req, res, "admin-login", {
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
    await limiter.recordFailureAsync(attempt);
    await new Promise(function (resolve) {
      setTimeout(resolve, 450);
    });
    return res.status(401).json({ error: "Wrong username or password." });
  }

  await limiter.resetAsync(attempt);
  admin.setSessionCookie(res, admin.adminUsername());
  return res.status(200).json({
    ok: true,
    username: admin.adminUsername(),
  });
};
