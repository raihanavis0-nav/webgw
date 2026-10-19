/* Story Admin PDF/DOCX import preview; replaces content ONLY after explicit approval. */
(function(root){
"use strict";
var input=null,dialog=null,view=null,status=null,confirmButton=null,pending=null,working=false;
function $(id){return document.getElementById(id);}
function element(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
function currentMode(){return $("storyFormatInput")?$("storyFormatInput").value:"prose";}
function apply(result){
 var textarea=$("storyBodyInput");
 if(!textarea)throw new Error("Buka Story Admin terlebih dahulu.");
 if(result.mode==="script"){
  if(root.ScriptWorkspace&&root.ScriptWorkspace.isOpen()){
   if(!root.ScriptWorkspace.replaceImported||!root.ScriptWorkspace.replaceImported(result))
    throw new Error("Gagal menambahkan naskah ke Script Editor.");
  }else{
   if(!root.ScriptAdminData||!root.ScriptAdminData.applyImportedScript)
    throw new Error("Script Admin belum siap untuk import.");
   root.ScriptAdminData.applyImportedScript(result.blocks);
  }
 }else{
  textarea.value=result.html;
  textarea.dispatchEvent(new Event("input",{bubbles:true}));
  if(root.ThoughtsEditor)root.ThoughtsEditor.setContent(result.html);
 }
}
function finish(){
 if(!pending)return;
 try{
  apply(pending);
  var count=pending.count;pending=null;dialog.close();
  window.alert("Import selesai ("+count+" blok). Periksa formatnya, lalu klik Save.");
 }catch(error){status.textContent=error.message||"Import gagal.";}
}
function preview(result){
 pending=result;
 view.textContent=result.preview;
 $("storyImportFilename").textContent=result.file+" · "+result.count+" blok terbaca";
 $("storyImportWarning").textContent=result.warnings.length
  ?result.warnings.join("  "):"Teks akan menggantikan isi editor. Periksa hasilnya sebelum menyimpan.";
 status.textContent="";
 confirmButton.disabled=false;
 dialog.showModal();
}
async function handleFile(file){
 if(!file||working)return;
 working=true;
 input.disabled=true;
 if(dialog&&dialog.open)dialog.close();
 try{
  var mode=currentMode();
  var result=await root.StoryImport.read(file,mode);
  preview(result);
 }catch(error){window.alert("Tidak bisa import: "+(error.message||String(error)));}
 finally{working=false;input.disabled=false;input.value="";}
}
function setup(){
 if(!$("storyWorkspace"))return;
 input=element("input");input.type="file";input.accept=".docx,.pdf,.txt,.fountain";
 input.setAttribute("aria-label","Choose PDF or Word manuscript");input.hidden=true;input.id="storyImportFileInput";
 document.body.appendChild(input);
 input.addEventListener("change",function(){handleFile(input.files&&input.files[0]);});
 dialog=element("dialog","story-import-dialog");dialog.id="storyImportDialog";
 var title=element("h2","", "Preview imported manuscript");
 dialog.appendChild(title);
 var filename=element("p","story-import-filename");filename.id="storyImportFilename";dialog.appendChild(filename);
 var warning=element("p","story-import-warning");warning.id="storyImportWarning";dialog.appendChild(warning);
 view=element("pre","story-import-preview");dialog.appendChild(view);
 status=element("p","story-import-error");status.setAttribute("role","status");dialog.appendChild(status);
 var actions=element("div","story-import-actions");
 var cancel=element("button","", "Cancel");cancel.type="button";cancel.addEventListener("click",function(){dialog.close();});
 confirmButton=element("button","story-import-confirm","Replace editor content");confirmButton.type="button";
 confirmButton.addEventListener("click",finish);
 actions.appendChild(cancel);actions.appendChild(confirmButton);
 dialog.appendChild(actions);document.body.appendChild(dialog);
 dialog.addEventListener("close",function(){pending=null;});
 var button=$("adminImportDocument");
 if(button)button.addEventListener("click",pick);
}
function pick(){
 if(!input||working)return;
 input.click();
}
root.StoryImportUI={pick:pick};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})(window);
