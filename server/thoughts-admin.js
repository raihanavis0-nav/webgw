const crypto = require("crypto");

const COOKIE_NAME = "thoughts_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

function adminUsername() {
  return String(process.env.THOUGHTS_ADMIN_USERNAME || "admin").trim() || "admin";
}

function adminPassword() {
  return process.env.THOUGHTS_ADMIN_PASSWORD || "";
}

function githubToken() {
  return process.env.THOUGHTS_GITHUB_TOKEN || "";
}

function isConfigured() {
  return Boolean(adminPassword() && githubToken());
}

function signingSecret() {
  const explicitSecret = String(process.env.THOUGHTS_SESSION_SECRET || "");
  const material = explicitSecret || adminPassword();

  return crypto
    .createHash("sha256")
    .update("thoughts-session\u0000" + material)
    .digest();
}

function safeEqual(a, b) {
  const left = crypto.createHash("sha256").update(String(a || "")).digest();
  const right = crypto.createHash("sha256").update(String(b || "")).digest();
  return crypto.timingSafeEqual(left, right);
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach(function (part) {
      const index = part.indexOf("=");
      if (index < 0) return;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key) out[key] = value;
    });
  return out;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signSession(username) {
  const payload = base64url(
    JSON.stringify({
      u: username,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    })
  );
  const signature = crypto
    .createHmac("sha256", signingSecret())
    .update(payload)
    .digest("base64url");
  return payload + "." + signature;
}

function verifySession(token) {
  if (!token || !isConfigured()) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;

  const payload = parts[0];
  const given = Buffer.from(parts[1]);
  const expected = Buffer.from(
    crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url")
  );

  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded || normalizeUsername(decoded.u) !== normalizeUsername(adminUsername())) {
      return null;
    }
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

function sessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifySession(cookies[COOKIE_NAME]);
}

function setSessionCookie(res, username) {
  const token = signSession(username);
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME +
      "=" +
      token +
      "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" +
      SESSION_TTL_SECONDS
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
  );
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    return new URL(origin).host === host;
  } catch (_) {
    return false;
  }
}

function requireSameOrigin(req, res) {
  if (sameOrigin(req)) return true;
  res.status(403).json({ error: "Invalid request origin." });
  return false;
}

function requireSession(req, res) {
  const session = sessionFromRequest(req);
  if (session) return session;
  noStore(res);
  res.status(401).json({ error: "Not authenticated." });
  return null;
}

function loginMatches(username, password) {
  return (
    safeEqual(normalizeUsername(username), normalizeUsername(adminUsername())) &&
    safeEqual(password, adminPassword())
  );
}

function githubHeaders() {
  return {
    Authorization: "Bearer " + githubToken(),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function githubJson(url, options) {
  const response = await fetch(
    url,
    Object.assign({}, options || {}, {
      headers: Object.assign({}, githubHeaders(), (options && options.headers) || {}),
    })
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error("GitHub request failed (" + response.status + ").");
    error.status = response.status;
    error.detail = text;
    throw error;
  }

  return response.json();
}

module.exports = {
  adminUsername,
  clearSessionCookie,
  githubJson,
  isConfigured,
  loginMatches,
  noStore,
  requireSameOrigin,
  requireSession,
  sessionFromRequest,
  setSessionCookie,
};
