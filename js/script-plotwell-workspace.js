/* Plotwell workspace: ProseMirror editing, legacy-compatible save, draft recovery. */
(function(){
"use strict";
var W=null,api=null,doc=null,dirty=false,syncTimer=0,saveTimer=0,session=0,options=null,ui={};
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
function refreshStats(){
 if(!W)return;
 var stat=W.getStats();
 ui.position.textContent=stat.sceneCount+" scenes  ·  "+stat.pageCount+" pages  ·  "+stat.wordCount+" words";
}
function refreshOutline(){
 if(!W)return;
 var content=W.toJSON().content||[];
 ui.nav.replaceChildren();
 var offset=1,scenes=0;
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
 if(!place){status("Enter a scene location first.",true);ui.location.focus();return;}
 var heading=window.ScriptEngine.sceneHeading(prefix,time,place);
 var view=W.view,state=view.state;
 var at=state.selection.$from.before(1);
 var node=state.schema.nodes.sceneHeading.create(null,state.schema.text(heading));
 view.dispatch(state.tr.insert(at,node));
 view.focus();ui.compose.hidden=true;ui.location.value="";
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
  status("Plotwell bundle is missing. Run the bundling workflow before using this editor.",true);
  if(ui.openError)ui.openError.hidden=false;
  return;
 }
 if(W)closeWorkspace();
 ui.shell.hidden=false;document.body.classList.add("script-workspace-open");
 ui.title.value=$("storyTitleInput").value||"";
 ui.navPanel.hidden=false;ui.compose.hidden=true;
 var draft=options.getDraft?options.getDraft():{body:$("storyBodyInput").value};
 var source=api.fromStory(draft);
 if(!source.content.length)source={type:"doc",content:[{type:"sceneHeading"}]};
 ui.page.replaceChildren();
 var mount=el("div","plotwell-editor-wrap");
 var inner=el("div","script-plotwell-mount");mount.appendChild(inner);ui.page.appendChild(mount);
 try{
  W=new window.PlotwellEmbed.PlotwellEditor({container:inner,doc:source,onChange:onChange,bubbleMenu:true,typeBadge:true,attribution:true});
 }catch(err){
  W=null;ui.shell.hidden=true;document.body.classList.remove("script-workspace-open");
  window.alert("Could not initialize Plotwell: "+err.message);return;
 }
 session++;dirty=false;doc=W.toJSON();refreshStats();refreshOutline();
 status("Ready · Enter continues a block · Tab changes element · Ctrl+S saves");
 if(W&&W.view)W.view.focus();
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
 var old=$("scriptLaunchRow"),btnOpen=$("scriptOpenBtn");
 if(!old||!btnOpen)return;
 var stage=$("storyBodyEditor");
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
 toolbar.appendChild(btn("Scenes",function(){ui.navPanel.hidden=!ui.navPanel.hidden;}));
 var elem=el("select");elem.setAttribute("aria-label","Screenplay element");
 ["scene","action","character","dialogue","parenthetical","transition"].forEach(function(k){var o=el("option","",k[0].toUpperCase()+k.slice(1));o.value=k;elem.appendChild(o);});
 elem.addEventListener("change",function(){updateKind(elem.value);});
 var picker=el("label","script-element-picker");picker.appendChild(el("span","", "ELEMENT"));picker.appendChild(elem);toolbar.appendChild(picker);
 toolbar.appendChild(btn("+ Scene",function(){ui.compose.hidden=!ui.compose.hidden;ui.location.focus();},"script-new-scene"));
 toolbar.appendChild(btn("Export PDF",function(){if(W)W.toPDF({title:scriptTitle()||"Screenplay"});}));
 toolbar.appendChild(btn("Fountain ↓",function(){
  if(!W)return;
  var blob=new Blob([W.toFountain()],{type:"text/plain;charset=utf-8"});
  var url=URL.createObjectURL(blob);var a=el("a");a.href=url;a.download=(scriptTitle()||"screenplay").replace(/[^\w-]+/g,"-")+".fountain";a.click();setTimeout(function(){URL.revokeObjectURL(url);},1500);
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
 toolbar.appendChild(btn("Import",function(){importInput.click();}));
 toolbar.appendChild(importInput);
 toolbar.appendChild(btn("Save",doSave,"script-main-save"));shell.appendChild(toolbar);
 var compose=el("div","script-scene-compose");compose.hidden=true;ui.compose=compose;
 compose.appendChild(el("strong","script-scene-title","NEW SCENE"));
 ui.sceneType=el("select");["INT.","EXT.","INT./EXT.","EST."].forEach(function(t){var o=el("option","",t);o.value=t;ui.sceneType.appendChild(o);});compose.appendChild(ui.sceneType);
 ui.location=el("input");ui.location.placeholder="Location";ui.location.setAttribute("aria-label","Scene location");compose.appendChild(ui.location);
 ui.time=el("select");["DAY","NIGHT","MORNING","AFTERNOON","DUSK","DAWN","CONTINUOUS"].forEach(function(t){var o=el("option","",t);o.value=t;ui.time.appendChild(o);});compose.appendChild(ui.time);
 compose.appendChild(btn("Insert scene",insertScene));shell.appendChild(compose);
 var main=el("div","script-main"),aside=el("aside","script-sidebar");aside.appendChild(el("p","script-sidebar-label","SCENE NAVIGATOR"));ui.nav=el("nav");aside.appendChild(ui.nav);ui.navPanel=aside;main.appendChild(aside);
 var stageBox=el("main","script-stage");ui.page=el("div","script-plotwell-stage");stageBox.appendChild(ui.page);main.appendChild(stageBox);shell.appendChild(main);
 var footer=el("footer","script-footer");ui.position=el("span","", "0 scenes");ui.status=el("span","script-save-state","");footer.appendChild(ui.position);footer.appendChild(ui.status);shell.appendChild(footer);
 document.body.appendChild(shell);
 btnOpen.textContent="Open Script Editor ↗";
 btnOpen.addEventListener("click",function(ev){ev.preventDefault();ev.stopImmediatePropagation();openWorkspace({getDraft:function(){return window.ScriptAdminData && window.ScriptAdminData.getDraft?window.ScriptAdminData.getDraft():{body:$("storyBodyInput").value};}});},true);
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
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();
