/* Server-authoritative writer activity metadata; draft content never goes to public feed. */
"use strict";
const EDIT_KEYS=new Set(["createdAt","updatedAt","publishedAt","lastPublicUpdateAt",
  "publicUpdateNote","publicUpdateType","publicFeedEnabled","announceOnSave",
  "announcementNote","announcementType"]);
function comparable(story){
  if(!story)return null;
  return Object.fromEntries(Object.entries(story).filter(([key])=>!EDIT_KEYS.has(key)));
}
function hasContent(story){
  return Boolean(String(story && story.body || "").replace(/<[^>]*>/g,"").trim() ||
    (story && story.scriptDoc && Array.isArray(story.scriptDoc.content) &&
     story.scriptDoc.content.some(n=>(n.content||[]).some(t=>String(t.text||"").trim()))));
}
function applyActivity(incoming,previous,now){
 const data=incoming||{},before=previous||{},oldStories=new Map((before.stories||[]).map(s=>[s.id,s]));
 const stamp=typeof now==="string"?now:new Date().toISOString();
 for(const story of data.stories||[]){
  const prior=oldStories.get(story.id),changed=!prior||JSON.stringify(comparable(prior))!==JSON.stringify(comparable(story));
  const announce=story.announceOnSave===true, note=String(story.announcementNote||"").trim().slice(0,240);
  const type=story.announcementType==="revised"?"revised":"new";
  delete story.announceOnSave;delete story.announcementNote;delete story.announcementType;
  // Never accept arbitrary client timestamps for authoritative activity history.
  if(prior){
    if(prior.createdAt)story.createdAt=prior.createdAt;else delete story.createdAt;
    if(prior.publishedAt)story.publishedAt=prior.publishedAt;else delete story.publishedAt;
    if(prior.updatedAt)story.updatedAt=prior.updatedAt;else delete story.updatedAt;
    for(const key of ["lastPublicUpdateAt","publicUpdateNote","publicUpdateType","publicFeedEnabled"]){
      if(prior[key]!==undefined)story[key]=prior[key];else delete story[key];
    }
    if(prior.publicFeedEnabled&&incoming.stories.find(s=>s.id===story.id)?.publicFeedEnabled===false)story.publicFeedEnabled=false;
  }else{
    story.createdAt=stamp;
    for(const key of ["updatedAt","publishedAt","lastPublicUpdateAt","publicUpdateNote","publicUpdateType","publicFeedEnabled"])delete story[key];
  }
  if(changed)story.updatedAt=stamp;
  if(story.published!==false&&hasContent(story)&&(!prior||prior.published===false)&&!story.publishedAt)story.publishedAt=stamp;
  if(announce&&story.published!==false&&hasContent(story)){
    story.lastPublicUpdateAt=stamp;story.publicUpdateNote=note;
    story.publicUpdateType=type;story.publicFeedEnabled=true;
  }
  if(story.published===false)story.publicFeedEnabled=false;
 }
 return data;
}
function feed(data,limit){
 const source=data||{},series=new Map((source.series||[]).map(s=>[s.id,s])),books=new Map((source.subseries||[]).map(s=>[s.id,s]));
 return (source.stories||[]).filter(story=>
  story && story.published!==false&&story.publicFeedEnabled===true&&
  typeof story.lastPublicUpdateAt==="string"&&Number.isFinite(Date.parse(story.lastPublicUpdateAt))&&hasContent(story)&&
  String(story.slug||"").length>0).map(story=>({
    id:String(story.id),title:String(story.title||"Untitled").slice(0,120),
    slug:String(story.slug).slice(0,140),
    series:String((series.get(story.seriesId)||{}).name||"").slice(0,120),
    book:String((books.get(story.subseriesId)||{}).name||"").slice(0,120),
    kind:story.publicUpdateType==="revised"?"revised":"new",
    note:String(story.publicUpdateNote||"").slice(0,240),
    at:story.lastPublicUpdateAt
  })).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,Math.max(0,Math.min(8,limit||5)));
}
module.exports={applyActivity,feed,hasContent,comparable};
