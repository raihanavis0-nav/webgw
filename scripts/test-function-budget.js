"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const apiDir = path.join(root, "api");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const handler = require("../api/thoughts-admin/login");

function apiEntrypoints(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(function (entry) {
    const full = path.join(directory, entry.name);
    return entry.isDirectory()
      ? apiEntrypoints(full)
      : entry.isFile() && entry.name.endsWith(".js") ? [full] : [];
  });
}

function fakeResponse() {
  return {
    code: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test("Hobby deployment stays within its 12-function limit", function () {
  const apiFiles = apiEntrypoints(apiDir);
  assert.ok(apiFiles.length <= 12, "Vercel Hobby permits only 12 Functions, got " + apiFiles.length);
  assert.equal(apiFiles.length, 11);
});

test("Legacy admin authentication paths are rewritten internally", function () {
  const rewrites = config.rewrites || [];
  for (const action of ["logout", "session"]) {
    const source = "/api/thoughts-admin/" + action;
    const destination = "/api/thoughts-admin/login?authAction=" + action;
    assert.ok(rewrites.some(rule => rule.source === source && rule.destination === destination));
    assert.equal(fs.existsSync(path.join(apiDir, "thoughts-admin", action + ".js")), false);
  }
});

test("Merged session endpoint retains GET-only behavior", async function () {
  const valid = fakeResponse();
  await handler({ method: "GET", query: { authAction: "session" }, headers: {} }, valid);
  assert.equal(valid.code, 200);
  assert.equal(typeof valid.body.configured, "boolean");
  assert.equal(typeof valid.body.authenticated, "boolean");

  const invalid = fakeResponse();
  await handler({ method: "POST", query: { authAction: "session" }, headers: {} }, invalid);
  assert.equal(invalid.code, 405);
  assert.equal(invalid.headers.allow, "GET");
});

test("Merged logout endpoint retains POST and same-origin requirements", async function () {
  const invalidMethod = fakeResponse();
  await handler({ method: "GET", query: { authAction: "logout" }, headers: {} }, invalidMethod);
  assert.equal(invalidMethod.code, 405);
  assert.equal(invalidMethod.headers.allow, "POST");

  const crossOrigin = fakeResponse();
  await handler({
    method: "POST", query: { authAction: "logout" },
    headers: { host: "example.com", origin: "https://other.example" },
  }, crossOrigin);
  assert.equal(crossOrigin.code, 403);

  const valid = fakeResponse();
  await handler({ method: "POST", query: { authAction: "logout" }, headers: { host: "example.com" } }, valid);
  assert.equal(valid.code, 200);
  assert.match(valid.headers["set-cookie"], /Max-Age=0/);
});

test("Merged login preserves POST-only validation", async function () {
  const invalid = fakeResponse();
  await handler({ method: "GET", query: {}, headers: {} }, invalid);
  assert.equal(invalid.code, 405);
  assert.equal(invalid.headers.allow, "POST");

  const unknown = fakeResponse();
  await handler({ method: "GET", query: { authAction: "unknown" }, headers: {} }, unknown);
  assert.equal(unknown.code, 404);
});
