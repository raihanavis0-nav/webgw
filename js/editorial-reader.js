(function(){
  "use strict";
  var KEY="thoughts_reader_continue_v1";
  var SIZE_KEY="thoughts_reader_font_size_v1";
  var minSize=16,maxSize=23,size=18;
  var lastWrite=0,scheduled=false,currentSlug="";
  var $=function(id){return document.getElementById(id);};
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function readLocal(key){
    try{return localStorage.getItem(key);}catch(_){return null;}
  }
  function writeLocal(key,value){
    try{localStorage.setItem(key,value);}catch(_){}
  }
  function readProgress(){
    try{
      var value=JSON.parse(readLocal(KEY)||"null");
      return value&&typeof value.slug==="string"&&value.slug.length<250?value:null;
    }catch(_){return null;}
  }
  function activeStory(){
    if(!$("storyView")||$("storyView").hidden||document.body.classList.contains("is-locked"))return "";
    return new URLSearchParams(window.location.search).get("story")||"";
  }
  function calculate(){
    if(!activeStory())return 0;
    var paper=$("chapterPaper");
    if(!paper)return 0;
    var bounds=paper.getBoundingClientRect();
    var top=window.scrollY+bounds.top;
    var height=paper.offsetHeight;
    var visible=window.innerHeight||800;
    var range=Math.max(1,height-visible*.65);
    return clamp(Math.round((window.scrollY-top+visible*.2)/range*100),0,100);
  }
  function update(){
    scheduled=false;
    var slug=activeStory();
    if(!slug)return;
    currentSlug=slug;
    var percent=calculate();
    $("readerProgressFill").style.width=percent+"%";
    if(Date.now()-lastWrite>=3200){
      // Never store story titles, chapter text, or passwords outside the authenticated app.
      writeLocal(KEY,JSON.stringify({slug:slug,percent:percent}));
      lastWrite=Date.now();
    }
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    window.requestAnimationFrame(update);
  }
  function fontSize(next){
    size=clamp(next,minSize,maxSize);
    if($("chapterPaper"))$("chapterPaper").style.setProperty("--reading-font-size",size+"px");
    writeLocal(SIZE_KEY,String(size));
    $("readerTextSmaller").disabled=size<=minSize;
    $("readerTextLarger").disabled=size>=maxSize;
  }
  function renderHome(data){
    var saved=readProgress(),link=$("readerContinue");
    if(!link)return;
    var story=saved&&data&&Array.isArray(data.stories)
      ? data.stories.find(function(entry){return entry.slug===saved.slug;})
      : null;
    if(!story){link.hidden=true;return;}
    link.href="read?story="+encodeURIComponent(story.slug);
    $("readerContinueTitle").textContent=story.title||"Return to your last chapter";
    link.hidden=document.body.dataset.readerScope!=="selector";
  }
  function renderStory(story){
    currentSlug=story.slug||"";
    lastWrite=0;
    fontSize(size);
    schedule();
  }
  function init(){
    var stored=Number(readLocal(SIZE_KEY));
    if(Number.isFinite(stored)&&stored>=minSize&&stored<=maxSize)size=stored;
    $("readerTextSmaller").addEventListener("click",function(){fontSize(size-1);schedule();});
    $("readerTextLarger").addEventListener("click",function(){fontSize(size+1);schedule();});
    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("resize",schedule,{passive:true});
    document.addEventListener("visibilitychange",function(){if(document.hidden)update();});
    window.addEventListener("pagehide",update);
    renderHome();
  }
  window.EditorialReading={renderHome:renderHome,renderStory:renderStory};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();