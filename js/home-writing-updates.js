/* Public homepage shows only server-approved announcement metadata, never story bodies. */
(function(){
"use strict";
var holder=document.getElementById("homeWritingUpdates"),list=document.getElementById("homeWritingList");
if(!holder||!list)return;
function node(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function pretty(iso){
 var date=new Date(iso);
 if(!Number.isFinite(date.getTime()))return "";
 return date.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
}
function card(item){
 var a=node("a","home-writing-card");a.href="/read?story="+encodeURIComponent(item.slug);
 var top=node("div","home-writing-card-top");
 top.appendChild(node("span","home-writing-category",item.kind==="revised"?"REVISED CHAPTER":"NEW CHAPTER"));
 top.appendChild(node("time","",pretty(item.at)));
 a.appendChild(top);
 a.appendChild(node("strong","home-writing-title",item.title));
 if(item.series)a.appendChild(node("span","home-writing-series",item.series+(item.book?" / "+item.book:"")));
 if(item.note)a.appendChild(node("p","home-writing-note",item.note));
 a.appendChild(node("span","home-writing-read","Read update ↗"));
 return a;
}
fetch("/api/thoughts/appearance-media?activity=1",{credentials:"omit",headers:{"Accept":"application/json"}})
 .then(function(r){if(!r.ok)throw Error("Updates unavailable");return r.json();})
 .then(function(data){
   var updates=Array.isArray(data.updates)?data.updates.slice(0,3):[];
   list.replaceChildren();
   updates.forEach(function(item){
     if(item&&typeof item.slug==="string"&&typeof item.title==="string")list.appendChild(card(item));
   });
   holder.hidden=list.childElementCount===0;
 })
 .catch(function(){holder.hidden=true;});
})();
