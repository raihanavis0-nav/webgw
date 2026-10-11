/* Regression tests for archive APIs and server-side resilience. No external network. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const store = require("../server/thoughts-store");
const limiter = require("../server/thoughts-rate-limit");

function mockResponse() {
  return {
    code: 200, headers: {},
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

test("Reader Appearance publishes previously missing interface controls", async () => {
  const original = store.readPublicLibrary;
  store.readPublicLibrary = async () => ({ data: { appearance: {
    title: "Archive",
    interface: { displayFont: "Newsreader", bodyFont: "Archivo",
      layoutWidth: "wide", cardStyle: "rounded", showHero: true, logo: "none" },
  } } });
  try {
    const handler = require("../api/thoughts/auth");
    const res = mockResponse();
    await handler({ method: "GET", query: { appearance: "1" }, headers: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.appearance.interface.displayFont, "Newsreader");
    assert.equal(res.body.appearance.interface.bodyFont, "Archivo");
    assert.equal(res.body.appearance.interface.layoutWidth, "wide");
    assert.equal(res.body.appearance.interface.cardStyle, "rounded");
    assert.equal(res.body.appearance.interface.showHero, true);
    assert.equal(res.body.appearance.interface.logo, "none");
  } finally {
    store.readPublicLibrary = original;
  }
});

test("Public appearance stays constrained to supported values", async () => {
  const original = store.readPublicLibrary;
  store.readPublicLibrary = async () => ({ data: { appearance: { interface: {
    displayFont: "Invalid Font", cardStyle: "hexagon", layoutWidth: "giant",
    logo: "../../secrets.svg",
  } } } });
  try {
    const res = mockResponse();
    await require("../api/thoughts/auth")({ method: "GET", query: { appearance: "1" }, headers: {} }, res);
    assert.equal(res.body.appearance.interface.displayFont, "Inter");
    assert.equal(res.body.appearance.interface.layoutWidth, "standard");
    assert.equal(res.body.appearance.interface.cardStyle, "soft");
    assert.equal(res.body.appearance.interface.logo, "");
  } finally {
    store.readPublicLibrary = original;
  }
});

test("Rate limiter blocks repeated attempts with retry-after", async () => {
  const req = { headers: { "x-vercel-forwarded-for": "203.0.113.90" } };
  const res = mockResponse();
  const opts = { maxFailures: 2, windowMs: 100000, blockMs: 100000 };
  const first = limiter.check(req, res, "regression-test", opts);
  assert.equal(first.allowed, true);
  limiter.recordFailure(first);
  const second = limiter.check(req, res, "regression-test", opts);
  assert.equal(second.allowed, true);
  limiter.recordFailure(second);
  const denied = limiter.check(req, res, "regression-test", opts);
  assert.equal(denied.allowed, false);
  assert.ok(Number(res.headers["retry-after"]) > 0);
  limiter.reset(denied);
});

test("Public Reader API excludes unpublished stories", async () => {
  const reader = require("../server/thoughts-public");
  const before = reader.requireSession;
  const readBefore = store.readPublicLibrary;
  reader.requireSession = () => ({ ok: true });
  store.readPublicLibrary = async () => ({ data: {
    series: [], subseries: [], characters: [], worldEntries: [], galleryItems: [],
    stories: [
      { id: "one", published: true, title: "Visible" },
      { id: "two", published: false, title: "Draft" },
    ],
  } });
  try {
    const res = mockResponse();
    await require("../api/thoughts/content")({ method: "GET", headers: {} }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.data.stories.map(s => s.id), ["one"]);
  } finally {
    reader.requireSession = before;
    store.readPublicLibrary = readBefore;
  }
});
