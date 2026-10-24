"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const store=require("../server/thoughts-store");
const activity=require("../server/story-activity");
const publicHandler=require("../api/thoughts/appearance-media");
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},
 status(n){this.code=n;return this;},json(d){this.body=d;return this;},send(d){this.body=d;return this;}};}
test("Homepage feed publishes only explicitly opted-in safe metadata",async()=>{
 const orig=store.readPublicLibrary;
 const good={id:"published",slug:"test",title:"Safe title",seriesId:"s",published:true,
   body:"<p>SECRET STORY TEXT</p>",publicFeedEnabled:true,
   lastPublicUpdateAt:"2026-10-24T12:00:00.000Z",publicUpdateNote:"A new chapter"};
 const secret={...good,id:"draft",title:"SECRET DRAFT",published:false};
 const notOpted={...good,id:"not-opted",title:"HIDDEN",publicFeedEnabled:false};
 store.readPublicLibrary=async()=>({data:{series:[{id:"s",name:"Story Series"}],
   stories:[good,secret,notOpted]}});
 try{
  const res=response();
  await publicHandler({method:"GET",query:{activity:"1"},headers:{}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.updates.length,1);
  assert.equal(res.body.updates[0].title,"Safe title");
  assert.equal(res.body.updates[0].series,"Story Series");
  assert.ok(!JSON.stringify(res.body).includes("SECRET STORY TEXT"));
  assert.ok(!JSON.stringify(res.body).includes("SECRET DRAFT"));
  assert.equal(Object.hasOwn(res.body.updates[0],"body"),false);
 }finally{store.readPublicLibrary=orig;}
});
test("Activity update remains hidden until both published and opted-in",()=>{
 const source={series:[],stories:[{id:"a",slug:"a",title:"A",published:true,
  body:"Chapter",announceOnSave:true,publicFeedEnabled:false}]};
 activity.applyActivity(source,{stories:[]},"2026-10-24T12:00:00.000Z");
 assert.equal(activity.feed(source).length,0);
 assert.ok(source.stories[0].publishedAt);
});
test("Homepage and Reader assets connect without a second Vercel Function",()=>{
 const fs=require("node:fs"),p=require("node:path"),root=p.resolve(__dirname,"..");
 const home=fs.readFileSync(p.join(root,"index.html"),"utf8");
 const reader=fs.readFileSync(p.join(root,"thoughts.html"),"utf8");
 const adm=fs.readFileSync(p.join(root,"thoughts-admin.html"),"utf8");
 assert.match(home,/id="homeWritingUpdates"/);
 assert.match(reader,/id="readerWhatsNew"/);
 assert.match(reader,/reader-activity\.js/);
 assert.match(adm,/id="storyAnnounceInput"/);
 assert.match(adm,/id="storyPublicFeedInput"/);
});
