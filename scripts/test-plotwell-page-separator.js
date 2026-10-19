"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// A visual browser check is still necessary, but this protects against
// accidental reintroduction of Plotwell's 100px separator overhang.
test("Script Editor page separator stays within its Letter paper column", () => {
  const css = fs.readFileSync(path.join(__dirname, "../css/script-workspace-centered.css"), "utf8");
  const rule = css.match(/\.script-workspace \.plotwell-editor-wrap \.pw-page-separator\s*\{([^}]+)\}/);
  assert.ok(rule, "Missing scoped Plotwell separator override");
  assert.match(rule[1], /width:\s*var\(--pw-page-w,\s*816px\)/);
  assert.match(rule[1], /margin-left:\s*calc\(-1\s*\*\s*var\(--pw-margin-left,\s*144px\)\)/);
  assert.doesNotMatch(rule[1], /\+\s*200px|- 100px/);
  assert.match(css, /\.script-workspace \.plotwell-editor-wrap \.pw-page-margin-top\s*\{[\s\S]*?width:\s*100%/);
});
