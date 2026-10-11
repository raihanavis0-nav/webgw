"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Timeline = require("../js/thoughts-timeline-core");

function episode(id, year, month, day, order, extras = {}) {
  return { id, slug:id, title:"Episode " + id, seriesId:"series-a", subseriesId:"book-a",
    timelineEnabled:true,timelineYear:year,timelineMonth:month,timelineDay:day,
    timelinePrecision:"day",order,published:true,...extras };
}
test("Timeline only includes published episodes in the selected Series/Sub-series", () => {
  const stories=[
    episode("1",2020,3,18,1),
    episode("2",2020,7,22,2,{seriesId:"series-b"}),
    episode("3",2020,4,12,3,{published:false}),
    episode("4",2020,5,7,4,{subseriesId:"book-b"})
  ];
  const all=Timeline.entries(stories);
  assert.deepEqual(all.map(x=>x.story.id),["1","4","2"]);
  assert.deepEqual(Timeline.entries(stories,"series-a","book-a").map(x=>x.story.id),["1"]);
});
test("Timeline dates follow chronology, not publication order", () => {
  const stories=[
    episode("autumn",2020,10,2,1,{date:"2026-01-01"}),
    episode("spring",2020,4,3,40,{date:"2026-10-10"}),
    episode("summer",2020,8,15,4,{date:"2024-05-06"})
  ];
  const entries=Timeline.entries(stories);
  assert.deepEqual(entries.map(x=>x.story.id),["spring","summer","autumn"]);
  assert.deepEqual(Timeline.groups(entries)[0].periods.map(x=>x.label),["Spring","Summer","Autumn"]);
});
test("Multiple months in a season share one compact horizontal period", () => {
  const entries=Timeline.entries([
    episode("march",2020,3,2,1),episode("april",2020,4,2,2),
    episode("may",2020,5,2,3),episode("june",2020,6,2,4),
  ]);
  assert.deepEqual(Timeline.groups(entries)[0].periods.map(p=>[p.label,p.items.length]),
    [["Spring",3],["Summer",1]]);
});
test("Exact dates validate leap years and reject impossible dates", () => {
  const good=Timeline.read(episode("leap",2020,2,29,1));
  const bad=Timeline.read(episode("bad",2021,2,29,1));
  assert.equal(Timeline.validate(good),"");
  assert.match(Timeline.validate(bad),/real calendar day/);
  assert.equal(Timeline.caption(good),"29 February 2020");
});
test("Month-only, season-only and year-only dates remain optional", () => {
  const month={enabled:true,year:2020,month:10,precision:"month"};
  const season={enabled:true,year:2020,season:"autumn",precision:"season"};
  const year={enabled:true,year:2020,precision:"year"};
  for(const date of [month,season,year])assert.equal(Timeline.validate(date),"");
  assert.equal(Timeline.caption(month),"October 2020");
  assert.equal(Timeline.caption(season),"Autumn 2020");
  assert.equal(Timeline.caption(year),"2020");
});
test("Legacy free-text dates survive until editors migrate them", () => {
  const old={id:"old",title:"Legacy",timelineEnabled:true,timelineLabel:"Three days later",timelineOrder:1};
  const entries=Timeline.entries([old]);
  assert.equal(entries.length,1);
  assert.equal(Timeline.caption(entries[0].date),"Three days later");
  assert.equal(Timeline.groups(entries)[0].label,"Other dates");
});
test("Date changes never mutate existing episode objects", () => {
  const before={id:"one",date:"2026-10-11",title:"Chapter"};
  const after=Timeline.patch(before,{enabled:true,year:2020,month:3,day:20,precision:"day"});
  assert.equal(before.timelineEnabled,undefined);
  assert.equal(after.date,before.date);
  assert.equal(after.timelineYear,2020);
  assert.equal(after.timelineMonth,3);
  assert.equal(after.timelineDay,20);
});

test("Reader renders chronological clickable snake lanes without content injection", () => {
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this.className="";this.textContent="";this.style={setProperty:()=>{}};this.classNames=new Set();this.classList={add:(x)=>this.classNames.add(x)}}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...nodes){this.children=nodes;}
    setAttribute(name,value){this.attrs[name]=value;}
    addEventListener(event,fn){this.events[event]=fn;}
  }
  const document={createElement:tag=>new Node(tag)};
  const window={ArchiveTimeline:Timeline,innerWidth:1280,addEventListener:()=>{}};
  const prevWindow=global.window,prevDocument=global.document;
  global.window=window;global.document=document;
  try{
    const filename=require.resolve("../js/thoughts-timeline-reader");
    delete require.cache[filename];
    require("../js/thoughts-timeline-reader");
    const host=new Node("div");
    const stories=[
      episode("a",2020,3,1,1),episode("b",2020,3,2,2),
      episode("c",2020,3,3,3),episode("d",2020,3,4,4),
      episode("e",2020,9,1,5)
    ];
    const count=window.ArchiveTimelineReader.render({
      host,stories,storyUrl:slug=>"/read?story="+slug,
      seriesById:()=>({name:"WHAT!"}),subseriesById:()=>({name:"Season 1"})
    });
    const found=[];
    function walk(node){found.push(node);for(const child of node.children)walk(child);}
    walk(host);
    const cards=found.filter(n=>n.className==="timeline-wave-card");
    const lanes=found.filter(n=>n.className==="timeline-wave-lane");
    assert.equal(count,5);
    assert.equal(cards.length,5);
    assert.equal(lanes.length,3);
    assert.ok(lanes[1].classNames.has("is-reverse"));
    assert.ok(cards.every(n=>n.href.startsWith("/read?story=")));
    assert.equal(cards[0].children[1].textContent,"Episode a");
  }finally{global.window=prevWindow;global.document=prevDocument;}
});

test("Admin Timeline Manager saves bulk dates without modifying publication dates", async () => {
  class Node {
    constructor(tag) {
      this.tag=tag;this.children=[];this.events={};this.attrs={};this.dataset={};
      this.hidden=false;this.disabled=false;this.checked=false;this.value="";
      this.textContent="";this.className="";this.style={setProperty(){}};
      this.classList={add:(value)=>{this.className += " " + value}};
    }
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...nodes){this.children=nodes;}
    addEventListener(type,fn){this.events[type]=fn;}
    setAttribute(key,value){this.attrs[key]=value;}
    focus(){this.focused=true;}
    querySelector(selector){
      const queue=[...this.children];
      while(queue.length){
        const node=queue.shift();
        if(selector==="input"&&node.tag==="input")return node;
        if(selector==="select"&&node.tag==="select")return node;
        if(selector.startsWith(".")&&node.className.split(/\s+/).includes(selector.slice(1)))return node;
        const field=selector.match(/\[data-field=([^\]]+)\]/);
        if(field&&node.dataset.field===field[1])return node;
        queue.push(...node.children);
      }
      return null;
    }
  }
  const ids=["timelineManagerSeries","timelineManagerBook","timelineManagerStatus",
    "timelineManagerSearch","timelineManagerStats","timelineManagerPending",
    "timelineManagerSave","timelineManagerList","timelineManagerMessage",
    "timelineManagerDiscard"];
  const nodes=Object.fromEntries(ids.map(id=>[id,new Node("div")]));
  const document={
    createElement:tag=>new Node(tag),
    getElementById:id=>nodes[id],
  };
  const window={ArchiveTimeline:Timeline,confirm:()=>true};
  const previousWindow=global.window,previousDocument=global.document;
  global.window=window;global.document=document;
  try{
    const source=require("node:fs").readFileSync(require.resolve("../js/thoughts-timeline-admin"),"utf8");
    new Function("window","document",source)(window,document);
    const originals=[
      {id:"1",title:"Episode One",seriesId:"s",subseriesId:"b",published:true,date:"2026-10-11"},
      {id:"2",title:"Episode Two",seriesId:"s",subseriesId:"b",published:true,date:"2026-10-12"}
    ];
    const data={stories:originals,series:[{id:"s",name:"Test Series"}],
      subseries:[{id:"b",seriesId:"s",name:"Season 1"}]};
    let saved=null;
    const manager=window.ArchiveTimelineAdmin;
    manager.init({
      getData:()=>data,
      save:async candidate=>{saved=candidate;return {ok:true}},
      openStory:()=>{}
    });
    manager.render();
    assert.equal(nodes.timelineManagerList.children.length,2);
    for(const [index,day] of [[0,"20"],[1,"21"]]){
      nodes.timelineManagerList.children[index].querySelector(".timeline-manager-edit").events.click();
      const row=nodes.timelineManagerList.children[index];
      const panel=row.querySelector(".timeline-manager-editor");
      assert.ok(panel);
      panel.querySelector("[data-field=year]").value="2020";
      panel.querySelector("[data-field=month]").value="9";
      panel.querySelector("[data-field=day]").value=day;
      panel.querySelector("[data-field=precision]").value="day";
      panel.querySelector("[data-field=enabled]").checked=true;
      panel.querySelector(".timeline-manager-fields").events.input();
    }
    assert.equal(manager.hasPending(),true);
    assert.equal(nodes.timelineManagerSave.disabled,false);
    nodes.timelineManagerSave.events.click();
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(saved);
    assert.deepEqual(saved.stories.map(s=>s.timelineDay),[20,21]);
    assert.deepEqual(saved.stories.map(s=>s.date),["2026-10-11","2026-10-12"]);
    assert.equal(originals[0].timelineEnabled,undefined);
    assert.equal(manager.hasPending(),false);
  }finally{
    global.window=previousWindow;
    global.document=previousDocument;
  }
});
