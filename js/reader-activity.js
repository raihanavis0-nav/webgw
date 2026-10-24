/* Reader↔writer updates: per-browser following + unread chapter badges.
   Continue Reading and scroll progress are provided by EditorialReading. */
(function(root){
"use strict";
var SEEN="thoughts_reader_seen_stories_v1",FOLLOW="thoughts_reader_follow_series_v1",FILTER="thoughts_reader_follow_filter_v1";
var activeStory=null, latestData=null;
function $(id){return document.getElementById(id);}
function stored(key,fallback){try{var data=JSON.parse(localStorage.getItem(key)||"null");return data===null?fallback:data;}catch(_){return fallback;}}
function store(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(_){}}
function node(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function activityAt(story){return story.lastPublicUpdateAt||story.publishedAt||"";}
function timestamp(v){var n=Date.parse(v||"");return Number.isFinite(n)?n:0;}
function unseen(story){var time=timestamp(activityAt(story));if(!time)return false;var seen=stored(SEEN,{});return timestamp(seen[String(story.id)])<time;}
function followed(id){return Boolean(id&&stored(FOLLOW,{})[String(id)]);}
function follow(id,yes){var all=stored(FOLLOW,{});if(!id)return;all[String(id)]=yes===true;store(FOLLOW,all);}
function labelTime(s){var at=timestamp(s);return at?new Date(at).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"";}
function makeItem(story,data){
 var series=(data.series||[]).find(function(s){return s.id===story.seriesId;});
 var a=node("a","reader-update-item");a.href="read?story="+encodeURIComponent(story.slug);
 var top=node("span","reader-update-kind",story.publicUpdateType==="revised"?"REVISED":"NEW CHAPTER");
 if(unseen(story))top.appendChild(node("b","reader-update-new","UNREAD"));
 a.appendChild(top);
 a.appendChild(node("strong","",story.title));
 var meta=(series?series.name+" · ":"")+labelTime(activityAt(story));
 a.appendChild(node("small","",meta));
 if(story.publicUpdateNote)a.appendChild(node("p","",story.publicUpdateNote));
 return a;
}
function renderHome(data,context){
 latestData=data;
 var rootPanel=$("readerWhatsNew"),list=$("readerUpdateList");
 if(!rootPanel||!list)return;
 var filter=$("readerOnlyFollowing");
 var onlyFollowing=Boolean(stored(FILTER,false));
 if(filter)filter.checked=onlyFollowing;
 var shown=(data.stories||[]).filter(function(story){
  return story.published!==false && String(story.slug||"") &&
   timestamp(activityAt(story)) &&
   (!context || !context.seriesId || story.seriesId===context.seriesId) &&
   (!onlyFollowing||followed(story.seriesId));
 }).sort(function(a,b){return timestamp(activityAt(b))-timestamp(activityAt(a));}).slice(0,6);
 list.replaceChildren();
 shown.forEach(function(story){list.appendChild(makeItem(story,data));});
 rootPanel.hidden=shown.length===0;
}
function renderStory(story,data){
 latestData=data;activeStory=story;
 var marker=$("readerStoryNewBadge");
 var wasNew=unseen(story);
 if(marker)marker.hidden=!wasNew;
 var current=stored(SEEN,{});
 current[String(story.id)]=activityAt(story)||new Date().toISOString();
 store(SEEN,current);
 var note=$("readerWriterNote");
 if(note){
  note.textContent=story.publicUpdateNote?"Writer’s update · "+story.publicUpdateNote:"";
  note.hidden=!story.publicUpdateNote;
 }
 var btn=$("readerFollowSeries");
 if(btn){
  btn.hidden=!story.seriesId;
  var update=function(){
   btn.textContent=followed(story.seriesId)?"✓ Following this series":"+ Follow this series";
   btn.setAttribute("aria-pressed",String(followed(story.seriesId)));
  };
  btn.onclick=function(){follow(story.seriesId,!followed(story.seriesId));update();};
  update();
 }
}
function init(){
 var check=$("readerOnlyFollowing");
 if(check)check.addEventListener("change",function(){
  store(FILTER,check.checked);
  if(latestData){
   var p=new URLSearchParams(location.search);
   renderHome(latestData,{seriesId:p.get("series")||""});
  }
 });
}
root.ReaderActivity={renderHome:renderHome,renderStory:renderStory,unseen:unseen};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window);
