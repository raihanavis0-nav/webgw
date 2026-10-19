"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ratings = require("../server/thoughts-ratings");
const reader = require("../server/thoughts-public");
const store = require("../server/thoughts-store");

function mockResponse() {
  return {
    code: 200, headers: {},
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

const valid = { seriesId: "series-01", voterId: "0123456789abcdef0123456789abcdef", rating: 5 };

test("book vote validation accepts only a real 1–5 integer and anonymous browser ID", () => {
  assert.deepEqual(ratings.parseVote(valid), { ...valid, score: 5 });
  for (const value of [0, 6, 3.5, "4", null, NaN]) {
    assert.equal(ratings.parseVote({ ...valid, rating: value }), null);
  }
  assert.equal(ratings.parseVote({ ...valid, seriesId: "../../admin" }), null);
  assert.equal(ratings.parseVote({ ...valid, voterId: "invalid" }), null);
  assert.equal(ratings.parseVote(null), null);
});

test("rating summary does not invent a score for zero votes", () => {
  assert.deepEqual(ratings.safeSummary([null, null]), { average: null, count: 0 });
  assert.deepEqual(ratings.safeSummary([14, 3]), { average: 4.7, count: 3 });
  assert.throws(() => ratings.safeSummary([20, 1]), /Invalid ratings/);
  assert.throws(() => ratings.safeSummary([-1, 0]), /Invalid ratings/);
});

test("Redis pipeline reads shared book totals without exposing credentials", async () => {
  const oldFetch = global.fetch;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "secret";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://redis.example/pipeline");
    assert.equal(options.headers.Authorization, "Bearer secret");
    const commands = JSON.parse(options.body);
    assert.equal(commands.length, 2);
    assert.equal(commands[0][0], "HMGET");
    return { ok: true, json: async () => [
      { result: ["9", "2"] }, { result: [null, null] },
    ] };
  };
  try {
    const data = await ratings.summaries([{ id: "first" }, { id: "second" }, { id: "first" }]);
    assert.deepEqual(data, {
      available: true, books: {
        first: { average: 4.5, count: 2 },
        second: { average: null, count: 0 },
      },
    });
  } finally {
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }
});

test("each book vote uses atomic Redis transaction and supports changed ratings", async () => {
  const oldFetch = global.fetch;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "secret";
  global.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    assert.equal(command[0], "EVAL");
    assert.equal(command[2], "3");
    assert.match(command[1], /HGET/);
    assert.match(command[1], /HINCRBY/);
    assert.match(command[1], /HSET/);
    assert.match(command[4], /:totals$/);
    assert.equal(command[7], "5");
    return { ok: true, json: async () => ({ result: [5, 1] }) };
  };
  try {
    assert.deepEqual(await ratings.vote(ratings.parseVote(valid), { headers: {} }),
      { average: 5, count: 1 });
  } finally {
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }
});

test("content API requires session, same-origin vote, and existing series", async () => {
  const handler = require("../api/thoughts/content");
  const oldSession = reader.requireSession;
  const oldSameOrigin = reader.requireSameOrigin;
  const oldRead = store.readPublicLibrary;
  const oldConfigured = ratings.configured;
  const oldVote = ratings.vote;
  const oldSummaries = ratings.summaries;
  reader.requireSession = () => ({ ok: true });
  reader.requireSameOrigin = (_req, res) => { res.status(403).json({ error: "Blocked" }); return false; };
  store.readPublicLibrary = async () => ({ data: { series: [{ id: "series-01" }], stories: [] } });
  ratings.configured = () => true;
  ratings.vote = async () => ({ average: 5, count: 1 });
  ratings.summaries = async () => ({ available: true, books: { "series-01": { average: 5, count: 1 } } });
  try {
    let res = mockResponse();
    await handler({ method: "POST", headers: {}, body: valid }, res);
    assert.equal(res.code, 403);
    reader.requireSameOrigin = () => true;
    res = mockResponse();
    await handler({ method: "POST", headers: {}, body: { ...valid, rating: 0 } }, res);
    assert.equal(res.code, 400);
    res = mockResponse();
    await handler({ method: "POST", headers: {}, body: { ...valid, seriesId: "unknown" } }, res);
    assert.equal(res.code, 404);
    res = mockResponse();
    await handler({ method: "POST", headers: {}, body: valid }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.summary, { average: 5, count: 1 });
    res = mockResponse();
    await handler({ method: "GET", headers: {}, query: { ratings: "1" } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.books["series-01"].average, 5);
  } finally {
    reader.requireSession = oldSession;
    reader.requireSameOrigin = oldSameOrigin;
    store.readPublicLibrary = oldRead;
    ratings.configured = oldConfigured;
    ratings.vote = oldVote;
    ratings.summaries = oldSummaries;
  }
});
