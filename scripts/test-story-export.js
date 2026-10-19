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


test("PDF output chooses Letter for scripts, A4 for prose, and escapes text",()=>{
 const prose=exporter.printHtml({format:"prose",title:"Notes",body:"<p>Hello &amp; goodbye</p>"});
 const script=exporter.printHtml({format:"script",title:"<Scene>",scriptDoc:{
  type:"doc",content:[{type:"sceneHeading",content:[{type:"text",text:"INT. TRAIN - NIGHT"}]}]
 }});
 assert.match(prose,/@page\{size:A4/);
 assert.match(script,/@page\{size:letter/);
 assert.match(script,/INT\. TRAIN - NIGHT/);
 assert.match(script,/&lt;Scene&gt;/);
 assert.doesNotMatch(script,/<h1><Scene>/);
});

test("generated .docx opens as a well-formed OOXML package",()=>{
 const child=require("node:child_process");
 const result=child.spawnSync("python3",["-c",[
  "import sys,io,zipfile,xml.etree.ElementTree as ET",
  "data=sys.stdin.buffer.read()",
  "with zipfile.ZipFile(io.BytesIO(data)) as z:",
  " assert z.testzip() is None",
  " expected={'[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels'}",
  " assert expected.issubset(set(z.namelist()))",
  " for name in expected: ET.fromstring(z.read(name))",
  " assert b'INT. TRAIN - NIGHT' in z.read('word/document.xml')",
 ].join("\n")],{
  input:Buffer.from(exporter.createDocx({format:"script",title:"Test",scriptDoc:{
   type:"doc",content:[{type:"sceneHeading",content:[{type:"text",text:"INT. TRAIN - NIGHT"}]}]
  }})),
  encoding:"utf8"
 });
 assert.equal(result.status,0,result.stderr||result.stdout);
});
