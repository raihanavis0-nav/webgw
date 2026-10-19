"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/script-engine.js");

test("Script mode has the six screenplay block types and smart transitions", () => {
  assert.deepEqual(S.KINDS, ["scene","action","character","dialogue","parenthetical","transition"]);
  assert.equal(S.NEXT.scene,"action");
  assert.equal(S.NEXT.character,"dialogue");
  assert.equal(S.NEXT.parenthetical,"dialogue");
  assert.equal(S.NEXT.dialogue,"character");
  assert.equal(S.NEXT.transition,"scene");
});

test("Scene builder normalizes INT / EXT, location and time", () => {
  assert.equal(S.sceneHeading("INT.","afternoon","train"),"INT. TRAIN - AFTERNOON");
  assert.equal(S.sceneHeading("EXT.","night","station"),"EXT. STATION - NIGHT");
  assert.equal(S.sceneHeading("invalid","", ""), "INT. LOCATION - DAY");
});

test("Writer serialization preserves blocks and escapes user text", () => {
  assert.equal(S.serialize([{kind:"character",text:"JAMES"}, {kind:"dialogue",text:"A & B < C"}]),
    '<p class="sp-character">JAMES</p>\n<p class="sp-dialogue">A &amp; B &lt; C</p>');
  assert.equal(S.serialize([{kind:"action",text:"Line 1\nLine 2"}]),
    '<p class="sp-action">Line 1<br>Line 2</p>');
  assert.equal(S.serialize([{kind:"bogus",text:"Test"}]), '<p class="sp-action">Test</p>');
});

test("Pagination counts scenes, forms Letter pages and splits long blocks", () => {
  const lines = [
    {kind:"scene",text:"INT. TRAIN - DAY"},
    {kind:"action",text:"A train runs."},
    {kind:"character",text:"JAMES"},
    {kind:"dialogue",text:"One two three four five six seven eight nine ten"},
    {kind:"scene",text:"EXT. STATION - NIGHT"},
  ];
  const measure = (_type,text) => Math.ceil(text.length / 11) * 20;
  const pages = S.compute(lines,measure,100);
  assert.ok(pages.length>=2);
  const flat=pages.flatMap(page=>page.fragments);
  assert.equal(flat.filter(part=>part.kind==="scene").length,2);
  assert.equal(flat.find(part=>part.kind==="scene").sceneNumber,1);
  assert.equal(flat.find(part=>part.source===4).sceneNumber,2);
  for(let i=0;i<lines.length;i++){
    assert.equal(flat.filter(part=>part.source===i).map(part=>part.text).join(""),lines[i].text);
  }
});
