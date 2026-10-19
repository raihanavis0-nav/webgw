/* Story exports shared by Prose, Screenplay and Script.
 * Native, editable Office Open XML (.docx) ZIP written without CDN or server storage.
 * PDF uses the browser's Save as PDF print dialog from a safe print-only page.
 */
(function(root){
"use strict";
var encoder=new TextEncoder();
var MIME="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function xml(t){return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function escapeHtml(t){return xml(t);}
function format(story){return ["prose","screenplay","script"].includes(story&&story.format)?story.format:"prose";}
function name(story){return String(story&&story.title||"Untitled story").trim()||"Untitled story";}
function fileName(story){return (name(story).replace(/[^\p{L}\p{N}._-]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,95)||"story");}
function textOfDoc(node){return (node&&node.content||[]).map(function(item){return item.text||"";}).join("");}
function blocksFromScriptDoc(doc){
 if(!doc||doc.type!=="doc"||!Array.isArray(doc.content))return [];
 var kinds={sceneHeading:"scene",action:"action",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition"};
 return doc.content.filter(function(node){return kinds[node.type];}).map(function(node){
  var kind=kinds[node.type],content=textOfDoc(node);
  if(kind==="parenthetical"&&content&&!/^\(.*\)$/.test(content))content="("+content+")";
  return {kind:kind,runs:[{text:content}],text:content};
 });
}
function pushText(runs,t,style){
 if(!t)return;
 var item={text:t,bold:!!style.bold,italic:!!style.italic,underline:!!style.underline};
 var prev=runs[runs.length-1];
 if(prev&&prev.bold===item.bold&&prev.italic===item.italic&&prev.underline===item.underline){prev.text+=t;return;}
 runs.push(item);
}
function runsFor(element){
 var runs=[];
 function walk(node,style){
  if(node.nodeType===3){pushText(runs,node.nodeValue||"",style);return;}
  if(node.nodeType!==1)return;
  var tag=node.tagName.toLowerCase();
  if(["script","style","iframe","noscript","svg","object","button","input"].includes(tag))return;
  if(tag==="br"){pushText(runs,"\n",style);return;}
  if(tag==="img"){pushText(runs,node.getAttribute("alt")?"[Image: "+node.getAttribute("alt")+"]":"[Image]",style);return;}
  var copy={bold:style.bold||tag==="b"||tag==="strong",italic:style.italic||tag==="em"||tag==="i",underline:style.underline||tag==="u"};
  Array.from(node.childNodes).forEach(function(child){walk(child,copy);});
 }
 Array.from(element.childNodes).forEach(function(child){walk(child,{bold:false,italic:false,underline:false});});
 return runs;
}
function blocksFromHtml(html,mode){
 if(typeof DOMParser==="undefined"){
  var plain=String(html||"").replace(/<br[^>]*>/gi,"\n").replace(/<[^>]*>/g,"");
  var names={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "};
  plain=plain.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g,function(all,entity){
   return entity==="#39"?"'":names[entity];
  });
  return [{kind:"action",runs:[{text:plain}]}];
 }
 var doc=new DOMParser().parseFromString(String(html||""),"text/html"),blocks=[];
 var valid="p div h1 h2 h3 h4 blockquote pre li".split(" ");
 function descend(node){
  if(node.nodeType===3){
   if(node.nodeValue&&node.nodeValue.trim())blocks.push({kind:"action",runs:[{text:node.nodeValue.trim()}]});
   return;
  }
  if(node.nodeType!==1)return;
  var tag=node.tagName.toLowerCase();
  if(["script","style","iframe","noscript","svg","button","form"].includes(tag))return;
  if(tag==="ul"||tag==="ol"||tag==="section"||tag==="article"||tag==="body"){
   Array.from(node.childNodes).forEach(descend);return;
  }
  if(!valid.includes(tag)){
   // Inline-only roots and unknown containers still preserve their text.
   if(node.querySelector&&node.querySelector("p,div,h1,h2,h3,li"))Array.from(node.childNodes).forEach(descend);
   else {var content=runsFor(node);if(content.length)blocks.push({kind:"action",runs:content});}
   return;
  }
  var cls=(node.getAttribute("class")||"").match(/\bsp-(scene|action|character|dialogue|parenthetical|transition)\b/);
  var kind=cls?cls[1]:tag==="h1"||tag==="h2"||tag==="h3"?"heading":tag==="blockquote"?"quote":tag==="li"?"list":"action";
  var runs=runsFor(node);
  if(tag==="li")runs.unshift({text:"• "});
  if(runs.length)blocks.push({kind:kind,runs:runs});
 }
 Array.from(doc.body.childNodes).forEach(descend);
 return blocks;
}
function blocksFor(story){
 // Script writer stores structured blocks; use them when available for fidelity.
 if(format(story)==="script"){
  var scripted=blocksFromScriptDoc(story&&story.scriptDoc);
  if(scripted.length)return scripted;
 }
 return blocksFromHtml(story&&story.body||"",format(story));
}
function plain(b){return(b.runs||[]).map(function(r){return r.text||"";}).join("");}
function wRun(run){
 var props=[];
 if(run.bold)props.push("<w:b/>");
 if(run.italic)props.push("<w:i/>");
 if(run.underline)props.push('<w:u w:val="single"/>');
 var text=String(run.text||"");
 return text.split("\n").map(function(chunk,i){
   return (i?'<w:r><w:br/></w:r>':"")+(chunk?"<w:r>"+(props.length?"<w:rPr>"+props.join("")+"</w:rPr>":"")+
    '<w:t xml:space="preserve">'+xml(chunk)+"</w:t></w:r>":"");
 }).join("");
}
function wParagraph(block,mode){
 var k=block.kind||"action",script=mode!=="prose",runs=block.runs||[{text:block.text||""}];
 var style="Normal",indent="",align="",bold=false;
 if(script){
  style="ScriptText";
  if(k==="scene"){bold=true;}
  if(k==="character")indent='<w:ind w:left="3000" w:right="600"/>';
  if(k==="dialogue")indent='<w:ind w:left="1440" w:right="1350"/>';
  if(k==="parenthetical")indent='<w:ind w:left="2100" w:right="1900"/>';
  if(k==="transition")align='<w:jc w:val="right"/>';
 }else if(k==="heading"){style="Heading1";bold=true;}
 else if(k==="quote")indent='<w:ind w:left="720" w:right="720"/>';
 var ppr='<w:pPr><w:pStyle w:val="'+style+'"/>'+indent+align+
  '<w:spacing w:after="'+(k==="character"||k==="parenthetical"?0:script?150:180)+'" w:line="'+(script?240:320)+'" w:lineRule="auto"/></w:pPr>';
 return "<w:p>"+ppr+(bold?'<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">'+xml(plain(block))+"</w:t></w:r>":runs.map(wRun).join(""))+"</w:p>";
}
function stylesXml(){
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
 '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="22"/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="ScriptText"><w:name w:val="Script Text"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="24"/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>'+
 '</w:styles>';
}
function wordXml(story,blocks){
 var mode=format(story),script=mode!=="prose";
 var size=script?'<w:pgSz w:w="12240" w:h="15840"/>':'<w:pgSz w:w="11906" w:h="16838"/>';
 var margins=script?'<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="2160" w:header="720" w:footer="720" w:gutter="0"/>':
 '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>';
 var title='<w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:after="360"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="'+(script?24:32)+'"/></w:rPr><w:t>'+xml(name(story))+'</w:t></w:r></w:p>';
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
 '<w:body>'+title+blocks.map(function(b){return wParagraph(b,mode);}).join("")+
 '<w:sectPr>'+size+margins+'</w:sectPr></w:body></w:document>';
}
var crcTable=null;
function crc32(bytes){
 if(!crcTable)crcTable=Array.from({length:256},function(_,n){var c=n;for(var k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 var v=0xffffffff;
 for(var i=0;i<bytes.length;i++)v=(v>>>8)^crcTable[(v^bytes[i])&255];
 return (v^0xffffffff)>>>0;
}
function u16(n){return Uint8Array.of(n&255,(n>>>8)&255);}
function u32(n){return Uint8Array.of(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255);}
function concat(arr){
 var size=arr.reduce(function(total,b){return total+b.length;},0),out=new Uint8Array(size),offset=0;
 arr.forEach(function(b){out.set(b,offset);offset+=b.length;});return out;
}
function zip(entries){
 var parts=[],directory=[],offset=0;
 entries.forEach(function(e){
  var filename=encoder.encode(e[0]),body=encoder.encode(e[1]),crc=crc32(body),size=body.length;
  var local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),
   u32(crc),u32(size),u32(size),u16(filename.length),u16(0),filename,body]);
  parts.push(local);
  directory.push(concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),
   u32(crc),u32(size),u32(size),u16(filename.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),filename]));
  offset+=local.length;
 });
 var central=concat(directory);
 return concat(parts.concat([central,concat([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),
  u32(central.length),u32(offset),u16(0)])]));
}
function createDocx(story){
 var blocks=blocksFor(story);
 return zip([
  ["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'],
  ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
  ["word/_rels/document.xml.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
  ["word/styles.xml",stylesXml()],
  ["word/document.xml",wordXml(story,blocks)]
 ]);
}
function download(bytes,filename,mime){
 var blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(function(){URL.revokeObjectURL(url);},2500);
}
function exportWord(story){
 try{download(createDocx(story),fileName(story)+".docx",MIME);return true;}
 catch(error){if(typeof window!=="undefined")window.alert("Word export failed: "+error.message);return false;}
}
function pdfHtml(story){
 var blocks=blocksFor(story),mode=format(story),script=mode!=="prose";
 var page=script?"letter":"A4";
 var body=blocks.map(function(block){
  var valid=["scene","action","character","dialogue","parenthetical","transition","heading","quote","list"];
  var kind=valid.includes(block.kind)?block.kind:"action";
  var text=(block.runs||[]).map(function(run){
   var r=escapeHtml(run.text||"").replace(/\n/g,"<br>");
   if(run.bold)r="<strong>"+r+"</strong>";
   if(run.italic)r="<em>"+r+"</em>";
   if(run.underline)r="<u>"+r+"</u>";
   return r;
  }).join("");
  return '<p class="'+kind+'">'+text+"</p>";
 }).join("");
 var css='@page{size:'+page+';margin:'+(script?"1in 1in 1in 1.5in":"1in")+'}'+
 'body{font-family:'+(script?'"Courier New",monospace':'Georgia,serif')+';font-size:'+(script?"12pt":"11pt")+';line-height:'+(script?"1.15":"1.55")+';color:#111;background:#fff;margin:0}'+
 'h1{text-align:center;font-size:'+(script?"14pt":"20pt")+';margin:0 0 32px}'+
 'p{margin:0 0 1em;overflow-wrap:anywhere;white-space:pre-wrap;break-inside:avoid}'+
 '.scene{font-weight:bold;text-transform:uppercase;margin-top:1.2em}.character{text-transform:uppercase;margin:1em 0 0 36%}'+
 '.dialogue{margin:0 18% 1em 17%}.parenthetical{margin:0 26% 0 27%}.transition{text-align:right;text-transform:uppercase}'+
 '.heading{font-size:15pt;font-weight:bold}.quote{margin-left:2em}.list{margin-left:2em}'+
 '@media screen{body{max-width:800px;padding:60px;margin:0 auto}#printBtn{position:fixed;right:20px;top:15px;padding:10px 15px;cursor:pointer;background:#222;color:white;border:0;border-radius:6px}}'+
 '@media print{#printBtn{display:none}}';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+escapeHtml(name(story))+
 '</title><style>'+css+'</style></head><body><button id="printBtn" onclick="window.print()">Print / Save PDF</button><h1>'+
 escapeHtml(name(story))+"</h1>"+body+"</body></html>";
}
function exportPdf(story){
 if(typeof window==="undefined")return false;
 var win=window.open("","_blank");
 if(!win){window.alert("Allow pop-ups to export PDF, then try again.");return false;}
 win.document.open();win.document.write(pdfHtml(story));win.document.close();
 win.focus();
 // Keep a usable print document open even when browser blocks auto-print.
 try{win.setTimeout(function(){win.print();},350);}catch(_){}
 return true;
}
var API={createDocx:createDocx,blocksFor:blocksFor,exportWord:exportWord,exportPdf:exportPdf,format:format};
root.StoryExport=API;
if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
