/* Plotwell workspace: ProseMirror editing, legacy-compatible save, draft recovery. */
(function(){
"use strict";
var W=null,api=null,doc=null,dirty=false,syncTimer=0,session=0,options=null,ui={};
function $(id){return document.getElementById(id);}
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function btn(label,fn,cls){var b=el("button",cls,label);b.type="button";b.addEventListener("click",fn);return b;}
function status(text,error){ui.status.textContent=text;ui.status.classList.toggle("script-status-error",!!error);}
function scriptTitle(){return $("storyTitleInput").value.trim();}
function persist(){
 if(!W||!api)return;
 doc=W.toJSON();
 var body=api.toLegacy(doc);
 var legacy=$("storyBodyInput");
 if(legacy.value!==body){legacy.value=body;legacy.dispatchEvent(new Event("input",{bubbles:true}));}
 var editor=$("storyBodyEditor");
 if(editor&&window.ThoughtsEditor)window.ThoughtsEditor.setContent(body);
 if(window.ScriptWorkspace)window.ScriptWorkspace.activeDoc=doc;
 window.dispatchEvent(new CustomEvent("script-doc-changed",{detail:{doc:doc}}));
}
function onChange(){
 dirty=true;
 clearTimeout(syncTimer);
 syncTimer=setTimeout(function(){persist();status("Unsaved · backup active");refreshOutline();refreshStats();},170);
}
function updateElementLabel(){
 if(!W||!ui.element)return;
 var name=W.view.state.selection.$from.parent.type.name;
 var kinds={sceneHeading:"scene",action:"action",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition"};
 ui.element.value=kinds[name]||"action";
}
function updateWelcome(){
 if(!W||!ui.welcome)return;
 var blocks=W.toJSON().content||[];
 var written=blocks.some(function(b){return(b.content||[]).some(function(t){return String(t.text||"").trim();});});
 ui.welcome.hidden=written;
 ui.shell.classList.toggle("is-empty-script",!written);
}
function markEmptySceneHeadings(){
 if(!W)return;
 W.view.state.doc.forEach(function(node, offset){
  if(node.type.name!=="sceneHeading")return;
  var element=W.view.nodeDOM(offset);
  if(element && element.classList){
   element.classList.toggle("script-heading-empty",!node.textContent.trim());
  }
 });
}
function showSceneNumbers(enabled){
 var visible=Boolean(enabled);
 ui.shell.classList.toggle("script-show-scene-numbers",visible);
 if(ui.sceneNumbersToggle){
  ui.sceneNumbersToggle.textContent=visible?"✓ Show Scene Numbers":"Show Scene Numbers";
  ui.sceneNumbersToggle.setAttribute("aria-pressed",String(visible));
 }
 try { localStorage.setItem("archive_script_scene_numbers",String(visible)); } catch(_){}
 markEmptySceneHeadings();
}
function refreshStats(){
 if(!W)return;
 var stat=W.getStats();
 ui.position.textContent=stat.sceneCount+" scenes  ·  "+stat.pageCount+" pages  ·  "+stat.wordCount+" words";
 updateElementLabel();updateWelcome();markEmptySceneHeadings();
}
function refreshOutline(){
 if(!W)return;
 var content=W.toJSON().content||[];
 ui.nav.replaceChildren();
 var offset=0,scenes=0;
 content.forEach(function(n){
  var len=2+(n.content||[]).reduce(function(t,v){return t+(v.text||"").length;},0);
  if(n.type==="sceneHeading"){
    scenes++;
    var label=(n.content||[]).map(function(t){return t.text||"";}).join("")||"Untitled scene";
    (function(pos,name,num){
      var a=btn(String(num).padStart(2,"0")+"  "+name,function(){
       try {
        var S=window.PlotwellEmbed.TextSelection;
        var max=W.view.state.doc.content.size;
        var at=Math.min(pos+1,max);
        W.view.dispatch(W.view.state.tr.setSelection(S.near(W.view.state.doc.resolve(at))));
        W.view.focus();
       }catch(_){W.view.focus();}
      },"script-scene-link");
      ui.nav.appendChild(a);
    })(offset,label,scenes);
  }
  offset+=len;
 });
 if(!scenes)ui.nav.appendChild(el("p","script-outline-empty","Scenes will appear as you write."));
}
function updateKind(kind){
 if(!W)return;
 var name={scene:"sceneHeading",action:"action",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition"}[kind]||"action";
 var view=W.view,state=view.state,sel=state.selection;
 var $from=sel.$from;
 var pos=$from.before(1);
 var node=state.doc.nodeAt(pos);
 if(!node||!state.schema.nodes[name]||node.type===state.schema.nodes[name])return;
 try{
  var tr=state.tr.setNodeMarkup(pos,state.schema.nodes[name],node.attrs,node.marks);
  view.dispatch(tr);view.focus();
 }catch(err){status("Select a screenplay line first.",true);}
}
function insertScene(){
 if(!W)return;
 var prefix=ui.sceneType.value,place=ui.location.value.trim(),time=ui.time.value;
 if(!place){status("Isi lokasi adegan dulu.",true);ui.location.focus();return;}
 var heading=window.ScriptEngine.sceneHeading(prefix,time,place);
 var view=W.view,state=view.state,at=state.selection.$from.before(1);
 var current=state.doc.nodeAt(at);
 var node=state.schema.nodes.sceneHeading.create(null,state.schema.text(heading));
 var action=state.schema.nodes.action.create();
 // Replace the first empty placeholder instead of creating phantom scene number "1".
 var replace=!!current&&current.content.size===0;
 var tr=replace
  ?state.tr.replaceWith(at,at+current.nodeSize,[node,action])
  :state.tr.insert(at,[node,action]);
 var cursor=at+node.nodeSize+1;
 tr=tr.setSelection(window.PlotwellEmbed.TextSelection.near(tr.doc.resolve(cursor),1));
 view.dispatch(tr.scrollIntoView());view.focus();
 ui.compose.hidden=true;ui.location.value="";
 updateWelcome();refreshStats();refreshOutline();
 status("Adegan dibuat. Langsung ketik aksinya.");
}
function doSave(){
 if(!W)return;
 clearTimeout(syncTimer);persist();
 if(!scriptTitle()){status("Give the script a title before saving.",true);ui.title.focus();return;}
 status("Saving to archive…");
 $("saveStoryBtn").click();
}
function openWorkspace(opts){
 options=opts||{};
 if(!window.PlotwellEmbed||!window.PlotwellEmbed.PlotwellEditor){
  window.alert("Editor belum berhasil dimuat. Refresh halaman lalu coba lagi.");
  return;
 }
 if(W)closeWorkspace();
 ui.shell.hidden=false;document.body.classList.add("script-workspace-open");
 ui.title.value=$("storyTitleInput").value||"";
 ui.navPanel.hidden=true;ui.compose.hidden=true;
 var sceneNumberPref=false;
 try { sceneNumberPref=localStorage.getItem("archive_script_scene_numbers")==="true"; } catch(_){}
 showSceneNumbers(sceneNumberPref);
 if(ui.outlineToggle)ui.outlineToggle.setAttribute("aria-expanded","false");
 var draft=options.getDraft?options.getDraft():{body:$("storyBodyInput").value};
 var source=api.fromStory(draft);
 if(!source.content.length||(source.content.length===1&&!(source.content[0].content||[]).some(function(t){return String(t.text||"").trim();}))){
   source={type:"doc",content:[{type:"action"}]};
 }
 ui.page.replaceChildren();
 var welcome=el("div","script-welcome");
 welcome.appendChild(el("div","script-welcome-kicker","MULAI MENULIS"));
 welcome.appendChild(el("strong","", "Naskah pertama lo dimulai di sini."));
 welcome.appendChild(el("p","", "Buat heading adegan otomatis, atau klik langsung di kertas untuk menulis aksi."));
 var begin=btn("＋ Buat adegan pertama",function(){ui.compose.hidden=false;ui.location.focus();},"script-welcome-primary");
 welcome.appendChild(begin);
 welcome.appendChild(btn("Langsung menulis aksi",function(){if(W)W.view.focus();},"script-welcome-secondary"));
 ui.page.appendChild(welcome);ui.welcome=welcome;
 var mount=el("div","plotwell-editor-wrap");
 var inner=el("div","script-plotwell-mount");mount.appendChild(inner);ui.page.appendChild(mount);
 try{
  W=new window.PlotwellEmbed.PlotwellEditor({container:inner,doc:source,onChange:onChange,bubbleMenu:true,typeBadge:false,attribution:false});
 }catch(err){
  W=null;ui.shell.hidden=true;document.body.classList.remove("script-workspace-open");
  window.alert("Could not initialize Plotwell: "+err.message);return;
 }
 session++;dirty=false;doc=W.toJSON();refreshStats();refreshOutline();
 status("Enter: baris berikut · Tab: ganti format · Ctrl+S: simpan");
 if(W&&W.view&&!ui.shell.classList.contains("is-empty-script"))W.view.focus();
}
function closeWorkspace(){
 if(!W)return;
 clearTimeout(syncTimer);persist();
 W.destroy();W=null;
 ui.page.replaceChildren();ui.shell.hidden=true;document.body.classList.remove("script-workspace-open");
 if($("scriptOpenBtn"))$("scriptOpenBtn").focus();
}
function setup(){
 api=window.ScriptPlotwellBridge;
 var stage=$("storyBodyEditor");
 if(!stage)return;
 var old=$("scriptLaunchRow");
 if(!old){
   old=el("div","script-launch");old.id="scriptLaunchRow";
   var intro=el("div");intro.appendChild(el("strong","", "Screenplay Editor"));
   intro.appendChild(el("p","", "Professional formatting, scene navigation and PDF export."));
   old.appendChild(intro);
   stage.insertAdjacentElement("afterend",old);
 }
 var btnOpen=$("scriptOpenBtn");
 if(!btnOpen){btnOpen=btn("Open Script Editor ↗",function(){});btnOpen.id="scriptOpenBtn";old.appendChild(btnOpen);}
 var shell=$("scriptWorkspace");
 if(shell)shell.remove();
 shell=el("section","script-workspace");shell.id="scriptWorkspace";shell.hidden=true;ui.shell=shell;
 var toolbar=el("header","script-toolbar");
 toolbar.appendChild(btn("← Story",closeWorkspace));
 var title=el("label","script-toolbar-title");title.appendChild(el("span","", "SCRIPT TITLE"));
 ui.title=el("input");ui.title.placeholder="Untitled script";ui.title.maxLength=160;
 ui.title.addEventListener("input",function(){
   $("storyTitleInput").value=ui.title.value;
   $("storyTitleInput").dispatchEvent(new Event("input",{bubbles:true}));
 });
 title.appendChild(ui.title);toolbar.appendChild(title);
 var scenes=btn("☷ Outline",function(){
  ui.navPanel.hidden=!ui.navPanel.hidden;
  scenes.setAttribute("aria-expanded",String(!ui.navPanel.hidden));
 });
 scenes.className="script-outline-toggle";scenes.setAttribute("aria-expanded","false");
 ui.outlineToggle=scenes;toolbar.appendChild(scenes);
 var elem=el("select");elem.setAttribute("aria-label","Screenplay element");
 ["scene","action","character","dialogue","parenthetical","transition"].forEach(function(k){var o=el("option","",k[0].toUpperCase()+k.slice(1));o.value=k;elem.appendChild(o);});
 elem.addEventListener("change",function(){updateKind(elem.value);});
 var picker=el("label","script-element-picker");picker.appendChild(el("span","", "FORMAT"));picker.appendChild(elem);toolbar.appendChild(picker);
 ui.element=elem;
 toolbar.appendChild(btn("＋ Scene",function(){ui.compose.hidden=!ui.compose.hidden;if(!ui.compose.hidden)ui.location.focus();},"script-new-scene"));
 var fileMenu=el("details","script-file-menu");
 var menuLabel=el("summary","", "⋯ File");
 menuLabel.setAttribute("aria-label","Import and export options");fileMenu.appendChild(menuLabel);
 var menuBody=el("div","script-file-menu-body");
 menuBody.appendChild(btn("Export PDF",function(){
   fileMenu.open=false;
   if(W)W.toPDF({title:scriptTitle()||"Screenplay"});
 }));
 menuBody.appendChild(btn("Export Word (.docx)",function(){
   fileMenu.open=false;
   if(W&&window.StoryExport&&window.ScriptAdminData&&window.ScriptAdminData.getDraft) {
     // Export the active editor state, not a previously saved snapshot.
     persist();
     window.StoryExport.exportWord(window.ScriptAdminData.getDraft());
   }
 }));
 var sceneNumberToggle=btn("Show Scene Numbers",function(){
  showSceneNumbers(!ui.shell.classList.contains("script-show-scene-numbers"));
 });
 sceneNumberToggle.setAttribute("aria-pressed","false");
 ui.sceneNumbersToggle=sceneNumberToggle;
 menuBody.appendChild(sceneNumberToggle);
 menuBody.appendChild(btn("Download Fountain",function(){
  if(!W)return;fileMenu.open=false;
  var blob=new Blob([W.toFountain()],{type:"text/plain;charset=utf-8"});
  var url=URL.createObjectURL(blob);var a=el("a");a.href=url;
  a.download=(scriptTitle()||"screenplay").replace(/[^\w-]+/g,"-")+".fountain";
  a.click();setTimeout(function(){URL.revokeObjectURL(url);},1500);
 }));
 var importInput=el("input");importInput.type="file";importInput.accept=".fountain,.txt,.fdx";importInput.hidden=true;
 importInput.addEventListener("change",function(){
  var file=this.files&&this.files[0];if(!file||!W)return;
  file.text().then(function(text){
   if(!window.confirm("Replace current script contents with "+file.name+"?"))return;
   if(/\.fdx$/i.test(file.name))W.importFDX(text);else W.importFountain(text);
   onChange();
  }).catch(function(e){status("Import failed: "+e.message,true);});
  this.value="";
 });
 menuBody.appendChild(btn("Import PDF / Word",function(){
  fileMenu.open=false;
  if(window.StoryImportUI)window.StoryImportUI.pick();
 }));
 menuBody.appendChild(btn("Import Fountain / FDX",function(){fileMenu.open=false;importInput.click();}));
 menuBody.appendChild(importInput);
 fileMenu.appendChild(menuBody);toolbar.appendChild(fileMenu);
 toolbar.appendChild(btn("Simpan",doSave,"script-main-save"));shell.appendChild(toolbar);
 var helper=el("div","script-mini-help","Nulis langsung di kertas  ·  Enter: lanjut  ·  Tab: ubah format  ·  Ctrl+S: simpan");
 shell.appendChild(helper);
 var compose=el("div","script-scene-compose");compose.hidden=true;ui.compose=compose;
 compose.appendChild(el("strong","script-scene-title","NEW SCENE"));
 ui.sceneType=el("select");["INT.","EXT.","INT./EXT.","EST."].forEach(function(t){var o=el("option","",t);o.value=t;ui.sceneType.appendChild(o);});compose.appendChild(ui.sceneType);
 ui.location=el("input");ui.location.placeholder="Location";ui.location.setAttribute("aria-label","Scene location");compose.appendChild(ui.location);
 ui.time=el("select");["DAY","NIGHT","MORNING","AFTERNOON","DUSK","DAWN","CONTINUOUS"].forEach(function(t){var o=el("option","",t);o.value=t;ui.time.appendChild(o);});compose.appendChild(ui.time);
 compose.appendChild(btn("Insert scene",insertScene));shell.appendChild(compose);
 var main=el("div","script-main"),aside=el("aside","script-sidebar");aside.appendChild(el("p","script-sidebar-label","SCENE NAVIGATOR"));ui.nav=el("nav");aside.appendChild(ui.nav);ui.navPanel=aside;main.appendChild(aside);
 var stageBox=el("main","script-stage");ui.page=el("div","script-plotwell-stage");
 stageBox.appendChild(ui.page);main.appendChild(stageBox);shell.appendChild(main);
 var footer=el("footer","script-footer");ui.position=el("span","", "0 scenes");ui.status=el("span","script-save-state","");footer.appendChild(ui.position);footer.appendChild(ui.status);shell.appendChild(footer);
 document.body.appendChild(shell);
 btnOpen.textContent="Open Script Editor ↗";
 btnOpen.addEventListener("click",function(ev){ev.preventDefault();openWorkspace({getDraft:function(){return window.ScriptAdminData && window.ScriptAdminData.getDraft?window.ScriptAdminData.getDraft():{body:$("storyBodyInput").value};}});});
 document.addEventListener("selectionchange",function(){
  if(W&&W.view&&W.view.hasFocus())updateElementLabel();
 });
 document.addEventListener("keydown",function(event){
  if(!W)return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();doSave();}
  else if(event.key==="Escape"&&!ui.compose.hidden){event.preventDefault();ui.compose.hidden=true;}
 });
 var indicator=$("saveIndicator");
 if(indicator)new MutationObserver(function(){
  if(!W)return;
  var message=indicator.getAttribute("aria-label")||"";
  if(message==="Saved")status("Saved to archive");
  if(message==="Unsaved")status("Unsaved changes");
  if(message==="Saving")status("Saving…");
 }).observe(indicator,{attributes:true,attributeFilter:["aria-label"]});
}
window.ScriptWorkspace={
 refreshMode:function(active){var s=$("storyWorkspace");if(s)s.classList.toggle("is-script-story",!!active);},
 close:closeWorkspace,isOpen:function(){return!!W;},
 getDoc:function(){return W?W.toJSON():doc;},
 getDirty:function(){return dirty;},
 replaceImported:function(result){
  if(!W||!result||!result.fountain)return false;
  W.importFountain(result.fountain);
  clearTimeout(syncTimer);
  persist();refreshOutline();refreshStats();
  dirty=true;status("Imported · unsaved, review then Save");
  return true;
 },
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();
