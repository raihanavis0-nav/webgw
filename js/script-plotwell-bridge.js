/* Lossless Plotwell screenplay document adapter; old Story.body stays readable. */
(function(root) {
  "use strict";
  var types = {scene:"sceneHeading",action:"action",character:"character",
    dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition"};
  var reverse = {sceneHeading:"scene",action:"action",character:"character",
    dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition"};
  var allowed = new Set(Object.keys(reverse).concat(["pageBreak"]));
  function hasDoc(doc) {
    return doc && doc.type==="doc" && Array.isArray(doc.content) &&
      doc.content.length > 0 && doc.content.every(function(node) {
        return node && allowed.has(node.type);
      });
  }
  function textOf(node) {
    return (node.content||[]).map(function(part) {
      return typeof part.text==="string" ? part.text : "";
    }).join("");
  }
  function convertLegacy(body) {
    var blocks=root.ScriptEngine ? root.ScriptEngine.parse(body||"") : [];
    return {type:"doc",content:blocks.map(function(block) {
      var type=types[block.kind]||"action";
      var value=String(block.text||"");
      if(type==="parenthetical") value=value.replace(/^\s*\(([\s\S]*)\)\s*$/,"$1");
      return {type:type,content:value?[{type:"text",text:value}]:[]};
    }).filter(Boolean)};
  }
  function fromStory(story) {
    if(hasDoc(story&&story.scriptDoc)) return JSON.parse(JSON.stringify(story.scriptDoc));
    var fallback=convertLegacy(story && story.body);
    if(!fallback.content.length) fallback.content=[{type:"sceneHeading"}];
    return fallback;
  }
  function toLegacy(doc) {
    if(!hasDoc(doc)) return "";
    var blocks=doc.content.filter(function(node) {return node.type!=="pageBreak";})
      .map(function(node) {
        var kind=reverse[node.type]||"action",txt=textOf(node);
        if(kind==="parenthetical") txt="("+txt+")";
        return {kind:kind,text:txt};
      });
    return root.ScriptEngine ? root.ScriptEngine.serialize(blocks) : "";
  }
  function stats(doc) {
    if(!hasDoc(doc)) return {scenes:0,words:0,blocks:0};
    var text=doc.content.map(textOf).join(" ");
    return {scenes:doc.content.filter(function(n){return n.type==="sceneHeading"&&textOf(n).trim();}).length,
      words:text.trim()?text.trim().split(/\s+/).length:0,blocks:doc.content.length};
  }
  root.ScriptPlotwellBridge={hasDoc:hasDoc,fromStory:fromStory,toLegacy:toLegacy,stats:stats};
  if(typeof module!=="undefined" && module.exports) module.exports=root.ScriptPlotwellBridge;
})(typeof window!=="undefined"?window:globalThis);
