const crypto = require("crypto");

const STORE_KEY = "__thoughts_auth_rate_limit_v1";
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_BLOCK_MS = 30 * 60 * 1000;
const DEFAULT_MAX_FAILURES = 8;

function store() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = new Map();
  }
  return globalThis[STORE_KEY];
}

function clientKey(req, scope) {
  const forwarded =
    req.headers["x-vercel-forwarded-for"] ||
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    "unknown";

  const ip = String(forwarded).split(",")[0].trim().slice(0, 128);
  return crypto
    .createHash("sha256")
    .update(String(scope || "auth") + "\u0000" + ip)
    .digest("hex");
}

function prune(now) {
  const entries = store();
  if (entries.size < 500) return;

  for (const [key, value] of entries) {
    if (
      (!value.blockedUntil || value.blockedUntil <= now) &&
      now - value.windowStartedAt > DEFAULT_WINDOW_MS * 2
    ) {
      entries.delete(key);
    }
  }
}

// Optional Upstash Redis REST atomic limiter shared across serverless instances.
function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return url && token ? { url: url.endsWith("/") ? url.slice(0,-1) : url, token } : null;
}
async function redisCommand(args) {
  const cfg = redisConfig();
  const response = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error("Distributed login limiter unavailable.");
  const payload = await response.json();
  if (payload.error) throw new Error("Distributed login limiter unavailable.");
  return payload.result;
}
const THROTTLE_SCRIPT = "local count=redis.call('INCR',KEYS[1]); " +
  "if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; " +
  "if count==tonumber(ARGV[3]) then redis.call('PEXPIRE',KEYS[1],ARGV[2]); end; " +
  "return {count,redis.call('PTTL',KEYS[1])}";
async function checkAsync(req, res, scope, options) {
  if (!redisConfig()) return check(req, res, scope, options);
  const config = Object.assign({
    windowMs: DEFAULT_WINDOW_MS, blockMs: DEFAULT_BLOCK_MS,
    maxFailures: DEFAULT_MAX_FAILURES,
  }, options || {});
  const key = "archive:login:" + clientKey(req, scope);
  // Count every remote attempt so simultaneous guesses cannot bypass the limit.
  const result = await redisCommand([
    "EVAL", THROTTLE_SCRIPT, "1", key,
    String(config.windowMs), String(config.blockMs), String(config.maxFailures),
  ]);
  const count = Number(result && result[0]);
  const ttlMs = Number(result && result[1]);
  if (!Number.isFinite(count)) throw new Error("Invalid limiter response.");
  const allowed = count <= config.maxFailures;
  const retryAfter = Math.max(1, Math.ceil(Math.max(ttlMs, 1000) / 1000));
  if (!allowed) res.setHeader("Retry-After", String(retryAfter));
  return { allowed, key, remote: true, config, retryAfter };
}
async function resetAsync(token) {
  if (!token) return;
  if (token.remote) await redisCommand(["DEL", token.key]);
  else reset(token);
}
async function recordFailureAsync(token) {
  if (token && !token.remote) recordFailure(token);
}
function check(req, res, scope, options) {
  const now = Date.now();
  const config = Object.assign(
    {
      windowMs: DEFAULT_WINDOW_MS,
      blockMs: DEFAULT_BLOCK_MS,
      maxFailures: DEFAULT_MAX_FAILURES,
    },
    options || {}
  );

  prune(now);

  const key = clientKey(req, scope);
  const current = store().get(key);

  if (!current) {
    return { allowed: true, key: key, config: config };
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    const retryAfter = Math.max(
      1,
      Math.ceil((current.blockedUntil - now) / 1000)
    );
    res.setHeader("Retry-After", String(retryAfter));
    return {
      allowed: false,
      key: key,
      config: config,
      retryAfter: retryAfter,
    };
  }

  if (now - current.windowStartedAt > config.windowMs) {
    store().delete(key);
    return { allowed: true, key: key, config: config };
  }

  return { allowed: true, key: key, config: config };
}

function recordFailure(token) {
  if (!token || !token.key) return;

  const now = Date.now();
  const current = store().get(token.key);

  if (
    !current ||
    now - current.windowStartedAt > token.config.windowMs
  ) {
    store().set(token.key, {
      failures: 1,
      windowStartedAt: now,
      blockedUntil: 0,
    });
    return;
  }

  current.failures += 1;

  if (current.failures >= token.config.maxFailures) {
    current.blockedUntil = now + token.config.blockMs;
  }

  store().set(token.key, current);
}

function reset(token) {
  if (!token || !token.key) return;
  store().delete(token.key);
}

module.exports = {
  check,
  checkAsync,
  resetAsync,
  recordFailureAsync,
  recordFailure,
  reset,
};
