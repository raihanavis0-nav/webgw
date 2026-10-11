/* Fast date assignment across many episodes. Uses existing Admin save/revision flow. */
(function () {
  "use strict";
  var config=null, pending=new Map(), expanded="", filters={series:"",book:"",status:"all",search:""}, saving=false;
  function $(id){return document.getElementById(id);}
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
  function storyIndex(a,b){
    return (Number(a.order||0)-Number(b.order||0)) ||
      String(a.title||"").localeCompare(String(b.title||""));
  }
  function dateFor(story){return pending.get(String(story.id)) || window.ArchiveTimeline.read(story);}
  function findStory(id){return (config.getData().stories||[]).find(function(s){return String(s.id)===String(id);});}
  function selectOptions(select,items,placeholder,value){
    select.replaceChildren();
    var none=el("option","",placeholder);none.value="";select.appendChild(none);
    items.forEach(function(entry){var opt=el("option","",entry.name || "Untitled");opt.value=String(entry.id);select.appendChild(opt);});
    select.value=value || "";
  }
  function makeField(label,type,field,value,min,max){
    var wrap=el("label","timeline-manager-field");
    wrap.appendChild(el("span","",label));
    var input=el(type==="select"?"select":"input","");
    input.dataset.field=field;
    if(type==="select"){
      (value.options || []).forEach(function(opt){var o=el("option","",opt.label);o.value=opt.value;input.appendChild(o);});
      input.value=value.current||"";
    }else{
      input.type=type;input.value=value == null || value===0 ? "" : String(value);
      input.inputMode="numeric";
      if(min!=null)input.min=String(min);
      if(max!=null)input.max=String(max);
      input.step="1";
    }
    wrap.appendChild(input);
    return wrap;
  }
  function editorPanel(story){
    var T=window.ArchiveTimeline, p=dateFor(story);
    var panel=el("div","timeline-manager-editor");
    panel.setAttribute("aria-label","Edit date for " + (story.title||"Untitled"));
    var toggle=el("label","timeline-manager-toggle");
    var check=el("input");check.type="checkbox";check.dataset.field="enabled";check.checked=!!p.enabled;
    toggle.appendChild(check);toggle.appendChild(el("span","","Include in Reader Timeline"));
    panel.appendChild(toggle);
    var fields=el("div","timeline-manager-fields");
    var precision=makeField("Date precision","select","precision",{
      current:p.precision || "day",
      options:[
        {value:"day",label:"Exact date"},{value:"month",label:"Month and year"},
        {value:"season",label:"Season and year"},{value:"year",label:"Year only"}
      ]
    });
    var year=makeField("Year","number","year",p.year,1,9999);
    var month=makeField("Month","select","month",{current:p.month ? String(p.month):"",
      options:[{value:"",label:"Choose month"}].concat(T.MONTHS.map(function(m,i){return{value:String(i+1),label:m};}))});
    var day=makeField("Day","number","day",p.day,1,31);
    var season=makeField("Season","select","season",{current:p.season||"",
      options:[{value:"",label:"Choose season"}].concat(T.SEASONS.map(function(s){return{value:s,label:s[0].toUpperCase()+s.slice(1)};}))});
    [precision,year,month,day,season].forEach(function(f){fields.appendChild(f);});
    panel.appendChild(fields);
    var note=el("p","timeline-manager-help","Timeline dates describe when the story happens, not its publication date.");
    panel.appendChild(note);
    var preview=el("div","timeline-manager-preview");
    preview.setAttribute("role","status");
    panel.appendChild(preview);
    var status=el("p","timeline-manager-error");status.setAttribute("role","alert");panel.appendChild(status);
    var latest=Object.assign({},p);
    function update(){
      var enabled=check.checked;
      latest={
        enabled:enabled,
        precision:precision.querySelector("select").value,
        year:T.num(year.querySelector("input").value),
        month:T.num(month.querySelector("select").value),
        day:T.num(day.querySelector("input").value),
        season:season.querySelector("select").value,
        legacyLabel:p.legacyLabel || ""
      };
      var mode=latest.precision;
      month.hidden=!(mode==="day"||mode==="month");
      day.hidden=mode!=="day";
      season.hidden=mode!=="season";
      var issue=T.validate(latest);
      status.textContent=issue;
      preview.textContent=enabled ?
        issue ? "Enter a valid date to publish on Timeline." : "Preview: " + T.caption(latest)
        : "Not included in Reader Timeline";
      if(story.published===false && enabled) preview.textContent+=" · Hidden until the episode is published";
      var original=T.read(story);
      var same=original.enabled===latest.enabled &&
        original.year===latest.year &&
        (original.precision||"day")===latest.precision &&
        original.month===latest.month && original.day===latest.day &&
        original.season===latest.season;
      if(same)pending.delete(String(story.id)); else pending.set(String(story.id),latest);
      var save=$("timelineManagerSave");
      save.disabled=saving||!pending.size;
      $("timelineManagerPending").textContent=pending.size ? pending.size + " unsaved" : "All changes saved";
    }
    fields.addEventListener("input",update);
    fields.addEventListener("change",update);
    check.addEventListener("change",update);
    // Initial display does not create a pending change.
    var mode=p.precision||"day";
    month.hidden=!(mode==="day"||mode==="month");
    day.hidden=mode!=="day";season.hidden=mode!=="season";
    preview.textContent=p.enabled ? (T.validate(p) ? "Legacy date needs a new calendar date." : "Preview: " + T.caption(p)) : "Not included in Reader Timeline";
    return panel;
  }
  function render(){
    var T=window.ArchiveTimeline;
    if(!config||!T||!$("timelineManagerList"))return;
    var data=config.getData();
    var stories=(data.stories||[]).slice();
    var series=(data.series||[]).slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    var seriesSelect=$("timelineManagerSeries"),bookSelect=$("timelineManagerBook");
    selectOptions(seriesSelect,series,"All series",filters.series);
    var books=(data.subseries||[]).filter(function(b){return !filters.series||String(b.seriesId)===filters.series;});
    books.sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
    if(filters.book&&!books.some(function(b){return String(b.id)===filters.book;}))filters.book="";
    selectOptions(bookSelect,books,"All sub-series",filters.book);
    $("timelineManagerSearch").value=filters.search;
    $("timelineManagerStatus").value=filters.status;
    var dated=stories.filter(function(story){
      var d=dateFor(story);
      return d.enabled && !T.validate(d) && d.year>0;
    }).length;
    var missing=stories.filter(function(story){var d=dateFor(story);return !d.enabled||!d.year||!!T.validate(d);}).length;
    $("timelineManagerStats").textContent=dated+" dated · "+missing+" not on Timeline · "+stories.length+" episodes";
    $("timelineManagerPending").textContent=pending.size?pending.size+" unsaved":"All changes saved";
    $("timelineManagerSave").disabled=saving||!pending.size;
    var host=$("timelineManagerList");host.replaceChildren();
    stories=stories.filter(function(story){
      var date=dateFor(story);
      if(filters.series&&String(story.seriesId)!==filters.series)return false;
      if(filters.book&&String(story.subseriesId)!==filters.book)return false;
      if(filters.status==="dated"&&!(date.enabled&&date.year&&!T.validate(date)))return false;
      if(filters.status==="undated"&&date.enabled&&date.year&&!T.validate(date))return false;
      if(filters.search&&!String(story.title||"").toLowerCase().includes(filters.search))return false;
      return true;
    }).sort(function(a,b){
      var group=String(a.seriesId||"").localeCompare(String(b.seriesId||"")) ||
        String(a.subseriesId||"").localeCompare(String(b.subseriesId||""));
      return group||storyIndex(a,b);
    });
    if(!stories.length){host.appendChild(el("p","timeline-manager-empty","No episodes match these filters."));return;}
    stories.forEach(function(story){
      var row=el("article","timeline-manager-row");
      var head=el("div","timeline-manager-row-head");
      var summary=el("div","timeline-manager-row-copy");
      var meta=el("span","timeline-manager-row-meta");
      var seriesName=(data.series||[]).find(function(item){return String(item.id)===String(story.seriesId);});
      var bookName=(data.subseries||[]).find(function(item){return String(item.id)===String(story.subseriesId);});
      meta.textContent=[seriesName&&seriesName.name,bookName&&bookName.name].filter(Boolean).join(" / ") || "Unassigned";
      var title=el("strong","timeline-manager-row-title",story.title||"Untitled episode");
      var date=dateFor(story),valid=date.enabled&&!T.validate(date)&&date.year;
      var dateLabel=el("span","timeline-manager-row-date",valid?T.caption(date):date.enabled&&date.legacyLabel?"Legacy: "+date.legacyLabel:"No timeline date");
      if(pending.has(String(story.id)))dateLabel.textContent+=" · Unsaved";
      if(story.published===false)dateLabel.textContent+=" · Draft";
      summary.appendChild(meta);summary.appendChild(title);summary.appendChild(dateLabel);
      head.appendChild(summary);
      var controls=el("div","timeline-manager-row-actions");
      var open=el("button","timeline-manager-edit",expanded===String(story.id)?"Close":"Edit date");
      open.type="button";open.setAttribute("aria-expanded",String(expanded===String(story.id)));
      open.addEventListener("click",function(){
        expanded=expanded===String(story.id)?"":String(story.id);
        render();
        if(expanded){var field=host.querySelector(".timeline-manager-row.is-editing [data-field=year]");if(field)field.focus();}
      });
      controls.appendChild(open);
      var editor=el("button","timeline-manager-open","Open episode ↗");
      editor.type="button";
      editor.addEventListener("click",function(){config.openStory(story.id);});
      controls.appendChild(editor);head.appendChild(controls);row.appendChild(head);
      if(expanded===String(story.id)){row.classList.add("is-editing");row.appendChild(editorPanel(story));}
      host.appendChild(row);
    });
  }
  function save(){
    if(saving||!pending.size)return;
    var T=window.ArchiveTimeline;
    var invalid=[];
    var data=config.getData();
    var byId=new Map((data.stories||[]).map(function(s){return [String(s.id),s];}));
    pending.forEach(function(date,id){var error=T.validate(date);if(error)invalid.push((byId.get(id)||{}).title+": "+error);});
    var message=$("timelineManagerMessage");
    if(invalid.length){
      message.textContent="Fix dates before saving: "+invalid.slice(0,3).join(" · ");
      return;
    }
    saving=true;message.textContent="Saving timeline dates…";
    $("timelineManagerSave").disabled=true;
    var candidate=JSON.parse(JSON.stringify(data));
    candidate.stories=candidate.stories.map(function(story){
      var date=pending.get(String(story.id));
      return date?T.patch(story,date):story;
    });
    config.save(candidate).then(function(){
      pending.clear();expanded="";
      message.textContent="Timeline dates saved.";
      render();
    }).catch(function(error){
      message.textContent=error.message||"Could not save. Your changes are retained.";
      render();
    }).finally(function(){saving=false;render();});
  }
  function init(options){
    config=options;
    var series=$("timelineManagerSeries"),book=$("timelineManagerBook");
    series.addEventListener("change",function(){filters.series=series.value;filters.book="";expanded="";render();});
    book.addEventListener("change",function(){filters.book=book.value;expanded="";render();});
    $("timelineManagerStatus").addEventListener("change",function(e){filters.status=e.target.value;expanded="";render();});
    $("timelineManagerSearch").addEventListener("input",function(e){filters.search=e.target.value.trim().toLowerCase();expanded="";render();});
    $("timelineManagerSave").addEventListener("click",save);
    $("timelineManagerDiscard").addEventListener("click",function(){
      if(pending.size&&!window.confirm("Discard "+pending.size+" unsaved timeline changes?"))return;
      pending.clear();expanded="";$("timelineManagerMessage").textContent="";render();
    });
  }
  window.ArchiveTimelineAdmin={init:init,render:render,hasPending:function(){return pending.size>0;}};
})();
