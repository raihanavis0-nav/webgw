/* Local, client-side Word/PDF import for all Story formats.
   PDF only contains positioned glyphs, so script block detection is best-effort.
   No source file is uploaded; nothing changes until the user confirms and saves. */
(function(root){
"use strict";
var MAX_SIZE=20*1024*1024, MAX_PAGES=250;
var SCRIPT_KINDS=["scene","action","character","dialogue","parenthetical","transition"];
function esc(t){return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function normalized(s){return String(s||"").replace(/\r\n?/g,"\n").replace(/\u00a0/g," ").trim();}
function isHeading(s){return /^(?:(?:INT|EXT|INT\/EXT|EXT\/INT|I\/E|EST)\.)\s+\S/i.test(s);}
function isTransition(s){return /^(?:CUT TO:|FADE (?:IN|OUT)(?: TO BLACK)?:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:)$/i.test(s);}
function isCharacter(s){
 if(!s||s.length>46||isHeading(s)||isTransition(s))return false;
 if(/[a-z]/.test(s)||/[.!?]$/.test(s)||/^\d/.test(s))return false;
 return /[A-Z]/.test(s)&&/^[A-Z0-9 \-'.()\/&]+$/.test(s)&&s.split(/\s+/).length<=5;
}
function linesToBlocks(lines,mode){
 var screenplay=mode!=="prose",out=[],expectDialogue=false,lastX=null;
 function add(kind,text){
  text=normalized(text);if(!text)return;
  var last=out[out.length-1];
  if(last&&last.kind===kind&&["dialogue","action"].includes(kind)){
   last.text+=" "+text;return;
  }
  out.push({kind:kind,text:text});
 }
 (lines||[]).forEach(function(line){
  var t=normalized(typeof line==="string"?line:line.text),gap=typeof line==="string"?0:(line.gap||0);
  if(!t){expectDialogue=false;lastX=null;return;}
  var x=typeof line==="string"?null:Number(line.x);
  var scene=isHeading(t),transition=isTransition(t);
  var cue=isCharacter(t)&&(!Number.isFinite(x)||lastX===null||x>lastX+35||expectDialogue===false);
  if(!screenplay){add("action",t);return;}
  if(scene){out.push({kind:"scene",text:t.toUpperCase()});expectDialogue=false;}
  else if(transition){out.push({kind:"transition",text:t.toUpperCase()});expectDialogue=false;}
  else if(cue&&!(expectDialogue&&x!==null&&lastX!==null&&x<lastX+25)){
   out.push({kind:"character",text:t.toUpperCase()});expectDialogue=true;
  }
  else if(expectDialogue&&/^\([^)]{1,110}\)$/.test(t)){
   out.push({kind:"parenthetical",text:t});expectDialogue=true;
  }
  else if(expectDialogue){
   add("dialogue",t);
   // A larger PDF vertical gap marks a new block, not another line of dialogue.
   if(gap>24)expectDialogue=false;
  }else{
   if(gap>17&&out.length&&out[out.length-1].kind==="action")out.push({kind:"action",text:t});
   else add("action",t);
  }
  if(Number.isFinite(x))lastX=x;
 });
 return out;
}
function toHtml(blocks,mode){
 return blocks.map(function(b){
  var kind=SCRIPT_KINDS.includes(b.kind)?b.kind:"action";
  if(mode==="prose")return "<p>"+esc(b.text)+"</p>";
  return '<p class="sp-'+kind+'">'+esc(b.text)+"</p>";
 }).join("\n");
}
function toFountain(blocks){
 var lines=[];
 blocks.forEach(function(b){
  var t=normalized(b.text);if(!t)return;
  if(b.kind==="scene"){lines.push("\n"+t.toUpperCase()+"\n");}
  else if(b.kind==="character"){lines.push("\n"+t.toUpperCase());}
  else if(b.kind==="dialogue"||b.kind==="parenthetical"){lines.push(t);}
  else if(b.kind==="transition"){lines.push("\n>"+t.toUpperCase()+"\n");}
  else {lines.push("\n"+(isCharacter(t)?"!":"")+t+"\n");}
 });
 return lines.join("\n").replace(/\n{4,}/g,"\n\n\n").trim();
}
function docxParagraphs(html){
 // Mammoth HTML is *untrusted input*; extract ONLY text from paragraph-like nodes.
 // No HTML, attributes, links, images, SVG or scripts from the file reach the editor.
 var doc=new DOMParser().parseFromString(String(html||""),"text/html");
 var paragraphs=Array.from(doc.body.querySelectorAll("p,h1,h2,h3,li,blockquote,pre"));
 return paragraphs.map(function(node){
  return {text:normalized(node.textContent),x:null,gap:0};
 }).filter(function(x){return x.text;});
}
async function importDocx(file){
 if(!root.mammoth||typeof root.mammoth.convertToHtml!=="function")
   throw new Error("Word importer belum dimuat. Coba refresh halaman.");
 var result=await root.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{
  convertImage:{imgElement:function(){return {value:"",messages:[]};}}
 });
 var lines=docxParagraphs(result.value);
 return {lines:lines,warnings:(result.messages||[]).slice(0,5).map(function(m){return String(m.message||m);})};
}
async function importPdf(file){
 var pdfjs=await import("./vendor/document-import/pdf.mjs");
 pdfjs.GlobalWorkerOptions.workerSrc=new URL("/js/vendor/document-import/pdf.worker.mjs",root.location.href).href;
 var bytes=new Uint8Array(await file.arrayBuffer());
 var pdf=await pdfjs.getDocument({data:bytes,useSystemFonts:true}).promise;
 if(pdf.numPages>MAX_PAGES){await pdf.destroy();throw new Error("PDF terlalu panjang (maksimal 250 halaman).");}
 var all=[],readChars=0;
 try{
  for(var i=1;i<=pdf.numPages;i++){
   var page=await pdf.getPage(i),content=await page.getTextContent();
   var list=content.items.filter(function(a){return a&&typeof a.str==="string"&&a.str.trim();})
    .map(function(a){return {text:a.str,x:a.transform[4],y:a.transform[5],width:a.width||0,height:a.height||12};});
   // Preserve reading order using glyph coordinates, not library extraction order.
   list.sort(function(a,b){return b.y-a.y||a.x-b.x;});
   var rows=[];
   list.forEach(function(t){
    var row=rows[rows.length-1];
    if(!row||Math.abs(row.y-t.y)>3){
     rows.push({y:t.y,items:[t]});
    }else row.items.push(t);
   });
   var prev=null;
   rows.forEach(function(row){
    row.items.sort(function(a,b){return a.x-b.x;});
    var result="",right=null,characterHeight=0;
    row.items.forEach(function(t){
     if(right!==null&&t.x-right>Math.max(2.3,t.height*.25))result+=" ";
     result+=t.text;
     right=t.x+t.width;characterHeight=Math.max(characterHeight,t.height);
    });
    var txt=normalized(result);
    if(!txt)return;
    var gap=prev?prev.y-row.y:0;
    all.push({text:txt,x:row.items[0].x,gap:gap,page:i,height:characterHeight});
    prev=row;
    readChars+=txt.length;
   });
   page.cleanup();
   if(i<pdf.numPages)all.push({text:"",page:i});
   if(readChars>1500000)throw new Error("Dokumen melebihi batas teks yang bisa diimpor.");
  }
 }finally{await pdf.destroy();}
 if(!all.length||readChars<10)throw new Error("PDF tidak berisi teks yang bisa dipilih. PDF hasil scan belum mendukung OCR.");
 return {lines:all,warnings:["PDF tidak menyimpan struktur screenplay. Periksa lagi heading, karakter, dan dialog setelah import."]};
}
async function read(file,mode){
 if(!file||!file.name)throw new Error("Pilih dokumen PDF atau Word.");
 if(file.size>MAX_SIZE)throw new Error("Ukuran file maksimal 20 MB.");
 var suffix=file.name.split(".").pop().toLowerCase(),result;
 if(suffix==="docx")result=await importDocx(file);
 else if(suffix==="pdf")result=await importPdf(file);
 else if(suffix==="txt"||suffix==="fountain"){
  result={lines:(await file.text()).split(/\r?\n/),warnings:[]};
 }else if(suffix==="doc")throw new Error("File .doc lama belum didukung. Simpan sebagai .docx di Word dulu.");
 else throw new Error("Format belum didukung. Gunakan .pdf, .docx, .txt, atau .fountain.");
 var blocks=linesToBlocks(result.lines,mode);
 if(!blocks.length)throw new Error("Dokumen kosong atau teks tidak dapat dibaca.");
 return {file:file.name,mode:mode,blocks:blocks,html:toHtml(blocks,mode),
  fountain:toFountain(blocks),warnings:result.warnings||[],
  count:blocks.length,preview:blocks.slice(0,6).map(function(x){return x.text;}).join("\n").slice(0,600)};
}
var API={read:read,linesToBlocks:linesToBlocks,toHtml:toHtml,toFountain:toFountain,isHeading:isHeading,isCharacter:isCharacter};
root.StoryImport=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
