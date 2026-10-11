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
    send(body) { this.body = body; return this; },
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

test("Opening media endpoint rejects non-decorative archive content", async () => {
  const oldRead = store.readPublicLibrary;
  const oldRaw = store.getRawFile;
  store.readPublicLibrary = async () => ({ data: { appearance: { login: {
    image: "assets/thoughts/intro.gif"
  } } } });
  store.getRawFile = async () => ({ buffer: Buffer.from("GIF89a") });
  try {
    const handler = require("../api/thoughts/appearance-media");
    const allowed = mockResponse();
    await handler({ method:"GET", query:{path:"assets/thoughts/intro.gif"} }, allowed);
    assert.equal(allowed.code, 200);
    assert.equal(allowed.headers["content-type"], "image/gif");
    const denied = mockResponse();
    await handler({ method:"GET", query:{path:"assets/thoughts/private.png"} }, denied);
    assert.equal(denied.code, 404);
  } finally {
    store.readPublicLibrary = oldRead;
    store.getRawFile = oldRaw;
  }
});

test("Reader scripts retain conflict recovery and lightweight preview logic", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname,"..");
  const admin = fs.readFileSync(path.join(root,"js/thoughts-admin.js"),"utf8");
  const reader = fs.readFileSync(path.join(root,"js/thoughts.js"),"utf8");
  assert.match(admin,/state\.conflictDraft\s*=\s*clone\(candidate\)/);
  assert.match(admin,/archive-unsaved-draft\.json/);
  assert.match(reader,/readerLoadRetry/);
  assert.match(reader,/createPosterLayoutSwitch/);
});

test("Chunked audio seeking reads only overlapping files", async () => {
  const media = require("../server/thoughts-media");
  const files = new Map([
    ["assets/thoughts/audio/chunks/a.part", Buffer.from("AAAA")],
    ["assets/thoughts/audio/chunks/b.part", Buffer.from("BBBB")],
    ["assets/thoughts/audio/chunks/c.part", Buffer.from("CCCC")],
  ]);
  const manifest = { kind:"chunked-audio", extension:"mp3", totalSize:12,
    chunks:Array.from(files, ([path, buffer]) => ({path,size:buffer.length})) };
  const calls = [];
  const fakeStore = {
    async getRawFile(path) {
      calls.push(path);
      if (path.endsWith(".chunks.json"))
        return { buffer:Buffer.from(JSON.stringify(manifest)) };
      return { buffer: files.get(path) };
    }
  };
  const range = await media.loadChunkedRange(
    fakeStore, "assets/thoughts/audio/track.chunks.json", "bytes=5-6"
  );
  assert.equal(range.buffer.toString(), "BB");
  assert.equal(range.start, 5);
  assert.equal(range.end, 6);
  assert.equal(range.total, 12);
  assert.deepEqual(calls, [
    "assets/thoughts/audio/track.chunks.json",
    "assets/thoughts/audio/chunks/b.part"
  ]);
});

test("Character casting credits link to encoded Google Images and use one separator", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const character = fs.readFileSync(path.join(root,"js/thoughts-character-detail.js"),"utf8");
  const style = fs.readFileSync(path.join(root,"css/thoughts-reader-polish.css"),"utf8");
  assert.match(character, /creditLink\.href = "https:\/\/www\.google\.com\/search\?tbm=isch&q=" \+ encodeURIComponent\(portrayed\)/);
  assert.match(character, /creditLink\.rel = "noopener noreferrer"/);
  assert.match(style, /\.character-detail-bio:has\(\+ \.character-detail-credit:not\(\[hidden\]\)\) > \.character-detail-fact:last-child/);
});

test("Opening Reader focuses a heading without outlining the full Library", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const entrance = fs.readFileSync(path.join(root,"js/thoughts-entrance.js"),"utf8");
  const style = fs.readFileSync(path.join(root,"css/thoughts-reader-polish.css"),"utf8");
  assert.doesNotMatch(entrance, /main\.focus\(\{ preventScroll: true \}\)/);
  assert.match(entrance, /heading\.focus\(\{ preventScroll: true \}\)/);
  assert.match(style, /#readerArchiveTitle\[tabindex="-1"\]:focus/);
});

test("Timeline Admin has one primary title and no duplicate panel heading", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.resolve(__dirname,"../thoughts-admin.html"),"utf8");
  assert.match(html, /id="adminLibraryTitle"/);
  assert.match(html, /data-admin-panel="timeline"/);
  assert.doesNotMatch(html, /<h2>Timeline Manager<\/h2>/);
});
