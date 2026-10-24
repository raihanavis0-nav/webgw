"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const A=require("../server/story-activity");
const stamp="2026-10-24T15:00:00.000Z";
function dataset(story){return {series:[{id:"series-1",name:"World"}],subseries:[],stories:[story]};}
const story={id:"s1",title:"Chapter 1",slug:"chapter-1",published:false,body:"<p>Beginning</p>"};
test("A regular save updates timestamps but does not reveal a draft or publish an announcement",()=>{
 const next=A.applyActivity(dataset({...story}),{stories:[]},stamp);
 assert.equal(next.stories[0].createdAt,stamp);
 assert.equal(next.stories[0].updatedAt,stamp);
 assert.equal(next.stories[0].publishedAt,undefined);
 assert.equal(A.feed(next).length,0);
});
test("A writer explicitly announces a non-empty published chapter",()=>{
 const old=dataset({...story});
 const next=A.applyActivity(dataset({...story,published:true,publicFeedEnabled:true,announceOnSave:true,announcementNote:"New scene",announcementType:"new"}),old,stamp);
 assert.equal(next.stories[0].publishedAt,stamp);
 assert.equal(next.stories[0].lastPublicUpdateAt,stamp);
 assert.equal(next.stories[0].announceOnSave,undefined);
 assert.deepEqual(A.feed(next).map(e=>({title:e.title,note:e.note})),[{title:"Chapter 1",note:"New scene"}]);
 assert.equal(A.feed(next)[0].body,undefined);
});
test("Edits without announcing do not change public update date",()=>{
 const prev=dataset({...story,published:true,createdAt:"2026-01-01T00:00:00Z",publishedAt:"2026-01-01T00:00:00Z",lastPublicUpdateAt:"2026-10-01T00:00:00Z",publicFeedEnabled:true,body:"<p>before</p>"});
 const next=A.applyActivity(dataset({...prev.stories[0],body:"<p>after</p>",lastPublicUpdateAt:"2099-01-01T00:00:00Z"}),prev,stamp);
 assert.equal(next.stories[0].lastPublicUpdateAt,prev.stories[0].lastPublicUpdateAt);
 assert.equal(next.stories[0].updatedAt,stamp);
});
test("Drafts and blank placeholders can never leak to public feed",()=>{
 const old={stories:[]};
 const next=A.applyActivity({...dataset({...story,published:true,body:"",announceOnSave:true}),stories:[
  {...story,id:"empty",published:true,body:"",announceOnSave:true},
  {...story,id:"draft",published:false,announceOnSave:true}
 ]},old,stamp);
 assert.equal(A.feed(next).length,0);
});

test("Explicit announcement without public opt-in stays off homepage",()=>{
 const candidate=dataset({...story,published:true,announceOnSave:true,publicFeedEnabled:false});
 const next=A.applyActivity(candidate,{stories:[]},stamp);
 assert.equal(next.stories[0].lastPublicUpdateAt,stamp);
 assert.equal(next.stories[0].publicFeedEnabled,false);
 assert.equal(A.feed(next).length,0);
});
