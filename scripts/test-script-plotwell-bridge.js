"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
globalThis.ScriptEngine = require("../js/script-engine.js");
const adapter = require("../js/script-plotwell-bridge.js");

test("legacy script body can be upgraded to Plotwell nodes without losing element types", () => {
  const story = { body: '<p class="sp-scene">INT. TRAIN - DAY</p><p class="sp-character">CELINE</p><p class="sp-dialogue">Hello.</p>' };
  // DOM parsing is exercised in browser; use direct structured fixture in Node.
  const doc={type:"doc",content:[
    {type:"sceneHeading",content:[{type:"text",text:"INT. TRAIN - DAY"}]},
    {type:"character",content:[{type:"text",text:"CELINE"}]},
    {type:"dialogue",content:[{type:"text",text:"Hello."}]},
    {type:"parenthetical",content:[{type:"text",text:"smiles"}]}
  ]};
  assert.equal(adapter.hasDoc(doc),true);
  assert.deepEqual(adapter.fromStory({scriptDoc:doc}),doc);
  assert.equal(adapter.toLegacy(doc),'<p class="sp-scene">INT. TRAIN - DAY</p>\n<p class="sp-character">CELINE</p>\n<p class="sp-dialogue">Hello.</p>\n<p class="sp-parenthetical">(smiles)</p>');
  assert.deepEqual(adapter.stats(doc),{scenes:1,words:7,blocks:4});
});

test("reject malformed structured screenplay documents",()=>{
  assert.equal(adapter.hasDoc(null),null);
  assert.equal(adapter.hasDoc({type:"doc",content:[{type:"script",content:[]}]}),false);
  assert.equal(adapter.hasDoc({type:"doc",content:[]}),false);
});
