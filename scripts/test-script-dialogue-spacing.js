"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const exporter=require("../js/story-export.js");

test("Dialogue turn adds a pause before the next character only",()=>{
 const script={title:"Spacing test",format:"script",scriptDoc:{
  type:"doc",content:[
   {type:"character",content:[{type:"text",text:"MAYA"}]},
   {type:"dialogue",content:[{type:"text",text:"First."}]},
   {type:"character",content:[{type:"text",text:"JAMES"}]},
   {type:"dialogue",content:[{type:"text",text:"Second."}]}
  ]
 }};
 const bytes=exporter.createDocx(script);
 // docx is a stored ZIP (no compression); document XML remains inspectable.
 const contents=Buffer.from(bytes).toString("utf8");
 const doc=contents.slice(contents.indexOf('<w:document '),contents.indexOf('</w:document>')+13);
 assert.match(doc, /First\.<\/w:t><\/w:r><\/w:p><w:p>/); // paragraphs are contiguous
 assert.match(doc, /<w:spacing w:after="300" w:line="240"/);
 assert.match(doc, /<w:spacing w:after="150" w:line="240"/);
 assert.match(doc, /<w:spacing w:after="0" w:line="240"/);
 const print=exporter.printHtml(script);
 assert.match(print, /\.dialogue\+\.character,\.parenthetical\+\.character\{margin-top:1\.45em\}/);
});

test("Editor and Reader styles apply only to the next speaker",()=>{
 const css=fs.readFileSync(path.join(__dirname,"../css/script-dialogue-spacing.css"),"utf8");
 assert.match(css,/p\.pm-dialogue \+ p\.pm-character/);
 assert.match(css,/var\(--pw-line-h, 16px\) \* 1\.25/);
 assert.match(css,/\.script-page \.sp-dialogue \+ \.sp-character/);
 assert.doesNotMatch(css,/\.sp-character \+ \.sp-dialogue/);
});
