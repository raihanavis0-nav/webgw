(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var defaults={ui:"#262D37",paper:"#FFFDF7",font:"",accent:"#E6BC78",width:"standard",radius:"square"};
function active(){return $("subseriesThemeCustom").checked}
function preview(){
  var T=window.SubseriesThemes,on=active();
  ["subseriesUiColor","subseriesPaperColor","subseriesAccentColor","subseriesPaperWidth","subseriesPaperRadius","subseriesUiFont"].forEach(function(id){$(id).disabled=!on});
  var bg=on?$("subseriesUiColor").value:defaults.ui;
  var paper=on?$("subseriesPaperColor").value:defaults.paper;
  var font=on?T.validFont($("subseriesUiFont").value):"";
  var accent=on?$("subseriesAccentColor").value:"";
  var width=on?$("subseriesPaperWidth").value:defaults.width;
  var radius=on?$("subseriesPaperRadius").value:defaults.radius;
  T.applyUi($("subseriesThemePreview"),{background:bg,font:font,accent:accent});
  T.applyPaper($("subseriesPaperPreview"),{background:paper,width:width,radius:radius});
  $("subseriesPaperPreview").style.setProperty("--chapter-paper-preview-width",width==="narrow"?"80%":width==="wide"?"100%":"92%");
  $("subseriesThemeHint").textContent=on?"This appearance applies to this Sub-series only.":"Default style in use. Check Customize to override.";
}
function open(item){
  var ui=item&&item.uiTheme||{},paper=item&&item.paperTheme||{};
  $("subseriesThemeCustom").checked=!!(ui.background||ui.font||ui.accent||paper.background||paper.width||paper.radius);
  $("subseriesUiColor").value=window.SubseriesThemes.validColor(ui.background,defaults.ui);
  $("subseriesPaperColor").value=window.SubseriesThemes.validColor(paper.background,defaults.paper);
  $("subseriesAccentColor").value=window.SubseriesThemes.validColor(ui.accent,defaults.accent);
  $("subseriesUiFont").value=window.SubseriesThemes.validFont(ui.font);
  $("subseriesPaperWidth").value=["narrow","standard","wide"].includes(paper.width)?paper.width:defaults.width;
  $("subseriesPaperRadius").value=["square","soft","rounded"].includes(paper.radius)?paper.radius:defaults.radius;
  preview();
}
function getValue(){
  if(!active())return{uiTheme:null,paperTheme:null};
  var T=window.SubseriesThemes,raw=$("subseriesUiFont").value.trim(),font=T.validFont(raw);
  if(raw&&!font)throw Error("Enter a valid Google Fonts name (up to 70 characters).");
  return{
    uiTheme:{background:T.validColor($("subseriesUiColor").value,defaults.ui),font:font,accent:T.validColor($("subseriesAccentColor").value,defaults.accent)},
    paperTheme:{background:T.validColor($("subseriesPaperColor").value,defaults.paper),width:$("subseriesPaperWidth").value,radius:$("subseriesPaperRadius").value}
  };
}
function editorPaper(id,items){
  var item=(items||[]).find(function(s){return String(s.id)===String(id)});
  window.SubseriesThemes.applyPaper($("chapterEditorPage"),item&&item.paperTheme);
}
document.addEventListener("DOMContentLoaded",function(){
  window.SubseriesThemes.suggestions.forEach(function(f){
    var opt=document.createElement("option");opt.value=f;$("subseriesUiFontSuggestions").appendChild(opt);
  });
  ["subseriesUiColor","subseriesPaperColor","subseriesAccentColor","subseriesPaperWidth","subseriesPaperRadius","subseriesUiFont"].forEach(function(id){
    $(id).addEventListener("input",preview);$(id).addEventListener("change",preview);
  });
  $("subseriesThemeCustom").addEventListener("change",preview);
  $("subseriesThemeReset").addEventListener("click",function(){
    $("subseriesThemeCustom").checked=false;
    $("subseriesUiColor").value=defaults.ui;
    $("subseriesPaperColor").value=defaults.paper;
    $("subseriesAccentColor").value=defaults.accent;
    $("subseriesPaperWidth").value=defaults.width;
    $("subseriesPaperRadius").value=defaults.radius;
    $("subseriesUiFont").value="";
    preview();
  });
  preview();
});
window.SubseriesThemeAdmin={open:open,getValue:getValue,editorPaper:editorPaper};
})();
