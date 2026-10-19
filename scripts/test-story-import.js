"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const imp=require("../js/story-import.js");

test("Script import recognizes scene headings, character cues and dialogue",()=>{
 const lines=[
  {text:"INT. PHARMACY - DAY",x:90,gap:0},
  {text:"A pharmacist stands behind the counter.",x:90,gap:26},
  {text:"AMIR",x:280,gap:25},
  {text:"Hello, can I have the prescription?",x:130,gap:14},
  {text:"PHARMACIST",x:275,gap:27},
  {text:"Yes, certainly.",x:130,gap:16},
 ];
 const b=imp.linesToBlocks(lines,"script");
 assert.deepEqual(b.map(x=>x.kind),["scene","action","character","dialogue","character","dialogue"]);
 assert.match(imp.toHtml(b,"script"),/class="sp-dialogue"/);
 assert.match(imp.toFountain(b),/INT\. PHARMACY - DAY/);
});

test("Prose import preserves separate Word paragraphs",()=>{
 const b=imp.linesToBlocks([{text:"First chapter.",paragraph:true},{text:"Second chapter.",paragraph:true}],"prose");
 assert.deepEqual(b.map(x=>x.text),["First chapter.","Second chapter."]);
 assert.equal(imp.toHtml(b,"prose"),"<p>First chapter.</p>\n<p>Second chapter.</p>");
});

test("Imported untrusted file text stays inert in editor HTML",()=>{
 const b=[{kind:"action",text:'<img src=x onerror="alert(1)"> & text'}];
 const html=imp.toHtml(b,"prose");
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
 assert.match(html,/&amp; text/);
});

test("Screensplay cues are never invented from plain lowercase lines",()=>{
 const b=imp.linesToBlocks(["He looks through the glass.","Then closes his eyes."],"script");
 assert.equal(b.length,1);
 assert.equal(b[0].kind,"action");
});


test("Safe inline Word formatting and heading semantic survives Prose import",()=>{
 const b=imp.linesToBlocks([{text:"Chapter one",html:"<strong>Chapter one</strong>",paragraph:true,heading:true},
  {text:"A marked word",html:"A <em>marked</em> word",paragraph:true}],"prose");
 const html=imp.toHtml(b,"prose");
 assert.equal(html,"<h2><strong>Chapter one</strong></h2>\n<p>A <em>marked</em> word</p>");
});
