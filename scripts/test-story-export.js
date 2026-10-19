"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const exporter=require("../js/story-export.js");

test("all three Story formats create valid editable Word packages",()=>{
 for (const format of ["prose","screenplay","script"]){
  const story={title:"Hello & World",format:format,scriptDoc:{
   type:"doc",content:[{type:"sceneHeading",content:[{type:"text",text:"INT. TRAIN - DAY"}]},
   {type:"character",content:[{type:"text",text:"JAMES"}]},{type:"dialogue",content:[{type:"text",text:"Hello there."}]}]
  },body:"<p>Test paragraph &amp; more</p>"};
  const bytes=exporter.createDocx(story);
  assert.equal(new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true),0x04034b50);
  assert.equal(new DataView(bytes.buffer,bytes.byteOffset).getUint32(bytes.length-22,true),0x06054b50);
  const ascii=Buffer.from(bytes).toString("utf8");
  assert.match(ascii,/word\/document\.xml/);
  assert.match(ascii,/word\/styles\.xml/);
  assert.match(ascii,/\[Content_Types\]\.xml/);
  assert.match(ascii,/Hello &amp; World/);
  if(format==="script")assert.match(ascii,/INT\. TRAIN - DAY/);
  if(format==="prose")assert.match(ascii,/Test paragraph &amp; more/);
 }
});

test("Word from scriptDoc preserves dialogue types",()=>{
 const blocks=exporter.blocksFor({format:"script",scriptDoc:{type:"doc",content:[
  {type:"sceneHeading",content:[{type:"text",text:"EXT. ROAD - DAY"}]},
  {type:"parenthetical",content:[{type:"text",text:"quietly"}]}
 ]}});
 assert.deepEqual(blocks.map(b=>b.kind),["scene","parenthetical"]);
 assert.equal(blocks[1].runs[0].text,"(quietly)");
});
