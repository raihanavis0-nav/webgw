"use strict";
// Shared ratings in the existing optional Upstash Redis instance.
// No ratings are fabricated when distributed storage is unavailable.
const crypto = require("node:crypto");
const PREFIX = "archive:book-ratings:v1:";
const MAX_HOURLY_WRITES = 100;

function config() {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

function publicId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function parseVote(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const seriesId = body.seriesId;
  const voterId = body.voterId;
  const score = body.rating;
  if (!publicId(seriesId) || typeof voterId !== "string" ||
      !/^[a-f0-9]{32}$/.test(voterId) ||
      !Number.isInteger(score) || score < 1 || score > 5) return null;
  return { seriesId, voterId, score };
}

function prefix(id) {
  return PREFIX + crypto.createHash("sha256").update(id).digest("hex");
}
function safeSummary(values) {
  const sum = Number(values && values[0]);
  const count = Number(values && values[1]);
  if (!Number.isSafeInteger(count) || count < 0 ||
      !Number.isSafeInteger(sum) || sum < 0 || sum > count * 5) {
    throw new Error("Invalid ratings response.");
  }
  return { average: count ? Math.round((sum / count) * 10) / 10 : null, count };
}

async function redis(path, commands) {
  const cfg = config();
  if (!cfg) {
    const error = new Error("Community ratings are not configured.");
    error.status = 503;
    throw error;
  }
  const response = await fetch(cfg.url + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Community ratings storage unavailable.");
  const payload = await response.json();
  if (payload && payload.error) throw new Error("Community ratings storage unavailable.");
  return payload;
}

async function summaries(series) {
  if (!config()) return { available: false, books: {} };
  const ids = [...new Set((series || []).map(function (item) {
    return item && item.id;
  }).filter(publicId))].slice(0, 200);
  if (!ids.length) return { available: true, books: {} };
  const commands = ids.map(function (id) {
    return ["HMGET", prefix(id) + ":totals", "sum", "count"];
  });
  const results = await redis("/pipeline", commands);
  if (!Array.isArray(results) || results.length !== ids.length) {
    throw new Error("Invalid ratings storage response.");
  }
  const books = {};
  ids.forEach(function (id, index) {
    if (results[index] && results[index].error) {
      throw new Error("Community ratings storage unavailable.");
    }
    books[id] = safeSummary(results[index] && results[index].result);
  });
  return { available: true, books };
}

// Atomic vote + aggregate update, including changed ratings and a coarse write cap.
// Voting twice with one browser identity updates the existing vote, not its count.
const VOTE_SCRIPT = [
  "local n=redis.call('INCR',KEYS[3])",
  "if n==1 then redis.call('EXPIRE',KEYS[3],3600) end",
  "if n>tonumber(ARGV[3]) then return {-1,redis.call('TTL',KEYS[3])} end",
  "local prev=redis.call('HGET',KEYS[1],ARGV[1])",
  "local score=tonumber(ARGV[2])",
  "if prev then",
  " redis.call('HINCRBY',KEYS[2],'sum',score-tonumber(prev))",
  "else",
  " redis.call('HINCRBY',KEYS[2],'sum',score)",
  " redis.call('HINCRBY',KEYS[2],'count',1)",
  "end",
  "redis.call('HSET',KEYS[1],ARGV[1],score)",
  "return {redis.call('HGET',KEYS[2],'sum'),redis.call('HGET',KEYS[2],'count')}",
].join(" ");

async function vote(voteData, req) {
  const base = prefix(voteData.seriesId);
  const secret = process.env.THOUGHTS_READER_SESSION_SECRET ||
    process.env.THOUGHTS_ACCESS_CODE || "ratings";
  const voter = crypto.createHmac("sha256", secret)
    .update(voteData.seriesId + "\0" + voteData.voterId).digest("hex");
  const ip = String(req.headers["x-vercel-forwarded-for"] ||
    req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown")
    .split(",")[0].trim().slice(0, 128);
  const client = crypto.createHmac("sha256", secret).update(ip).digest("hex");
  const payload = await redis("", [
    "EVAL", VOTE_SCRIPT, "3", base + ":votes", base + ":totals",
    PREFIX + "write-limit:" + client, voter, String(voteData.score),
    String(MAX_HOURLY_WRITES),
  ]);
  const result = payload && payload.result;
  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error("Invalid ratings storage response.");
  }
  if (Number(result[0]) === -1) {
    const error = new Error("Too many ratings submitted. Try again later.");
    error.status = 429;
    error.retryAfter = Math.max(1, Number(result[1]) || 1);
    throw error;
  }
  return safeSummary(result);
}
module.exports = { configured: () => Boolean(config()), parseVote, safeSummary, summaries, vote };
